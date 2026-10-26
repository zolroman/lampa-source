import Arrays from './utils/arrays'
import Subscribe from './utils/subscribe'
import ContentRows from './core/content_rows'
import Lang from './core/lang'
import Utils from './utils/utils'
import Api from './sync_api'
import SyncAuth from './sync_auth'
import CoreFavorite from './core/favorite'

const categories = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown']
const marks = ['look', 'viewed', 'scheduled', 'continued', 'thrown']
const cache_ttl = 3000
const batch_delay = 25

let data = empty()
let favorite = CoreFavorite
let listener = favorite.listener || Subscribe()
let status_cache = {}
let list_loaded_at = {}
let status_loaded_at = {}
let inflight_lists = {}
let pending_status_ids = {}
let pending_status_waiters = []
let pending_status_timer = null

function empty(){
    let result = {
        card: []
    }

    categories.forEach((type)=>{
        result[type] = []
    })

    return result
}

function init(){
    read(true)

    ContentRows.add({
        name: 'continue_watch',
        title: Lang.translate('title_continue'),
        index: 1,
        screen: ['main', 'category'],
        call: (params, screen)=>{
            let media   = screen == 'main' ? 'tv' : params.url
            let results = continues(media)

            if(!results.length) return

            return function(call){
                call({
                    results,
                    title: media == 'tv' || media == 'anime' ? Lang.translate('title_continue') : Lang.translate('title_watched')
                })
            }
        }
    })
}

function ensure(flags = {}){
    let result = {
        any: false
    }

    categories.forEach((type)=>{
        result[type] = Boolean(flags[type])
        if(result[type]) result.any = true
    })

    return result
}

function hasSession(){
    return SyncAuth.hasSession()
}

function sendState(method, type, card, reason = 'update'){
    if(!window.Lampa || !Lampa.Listener) return

    Lampa.Listener.send('state:changed', {
        target: 'favorite',
        reason,
        method,
        type,
        card
    })
}

function refresh(silent = false){
    if(silent || !window.Lampa || !Lampa.Listener) return

    Lampa.Listener.send('state:changed', {
        target: 'favorite',
        reason: 'read'
    })
}

function rebuildCards(){
    let next_cards = []
    let used = {}

    categories.forEach((type)=>{
        data[type].forEach((id)=>{
            used[id] = true
        })
    })

    data.card.forEach((card)=>{
        if(used[card.id]) next_cards.push(card)
    })

    data.card = next_cards
}

function setCard(card){
    if(!card || !card.id) return

    let clear = Utils.clearCard(Arrays.clone(card))
    let index = data.card.findIndex((elem)=>elem.id == clear.id)

    if(index >= 0) data.card[index] = clear
    else data.card.push(clear)
}

function searchCard(id){
    return data.card.find((card)=>card.id == id)
}

function setFlags(card_id, flags, requested_at = 0){
    if(requested_at && status_loaded_at[card_id] && status_loaded_at[card_id] > requested_at) return

    status_cache[card_id] = ensure(flags)
    status_loaded_at[card_id] = Date.now()
}

function updateStatusFromData(card_id){
    let flags = {
        any: false
    }

    categories.forEach((type)=>{
        flags[type] = data[type].indexOf(card_id) >= 0
        if(flags[type]) flags.any = true
    })

    status_cache[card_id] = flags
    status_loaded_at[card_id] = Date.now()
}

function markTypeTouched(type){
    list_loaded_at[type] = Date.now()
}

function applyLists(lists = {}, requested = [], requested_at = 0){
    requested.forEach((type)=>{
        if(categories.indexOf(type) < 0) return
        if(requested_at && list_loaded_at[type] && list_loaded_at[type] > requested_at) return

        let cards = (lists[type] || []).map((card)=>Utils.clearCard(Arrays.clone(card)))

        data[type] = cards.map((card)=>card.id)

        cards.forEach((card)=>{
            setCard(card)
        })

        list_loaded_at[type] = Date.now()
    })

    rebuildCards()

    data.card.forEach((card)=>updateStatusFromData(card.id))
}

function loadTypes(types = categories, force = false){
    let needed = types.filter((type)=>{
        if(categories.indexOf(type) < 0) return false
        return force || !list_loaded_at[type] || list_loaded_at[type] < Date.now() - cache_ttl
    })

    if(!needed.length || !hasSession()) return Promise.resolve()

    let key = needed.slice().sort().join(',')
    if(inflight_lists[key]) return inflight_lists[key]

    let requested_at = Date.now()

    inflight_lists[key] = Api.bookmarksList({
        types: needed
    }).then((result)=>{
        applyLists(result.lists || {}, needed, requested_at)
        refresh()
    }).catch(()=>{}).finally(()=>{
        delete inflight_lists[key]
    })

    return inflight_lists[key]
}

function flushStatusQueue(){
    pending_status_timer = null

    let requested = Object.keys(pending_status_ids).map((id)=>parseInt(id, 10)).filter((id)=>id > 0)
    let waiters = pending_status_waiters.slice()
    let requested_at = Date.now()

    pending_status_ids = {}
    pending_status_waiters = []

    if(!requested.length || !hasSession()){
        waiters.forEach((waiter)=>waiter.resolve())
        return
    }

    Api.bookmarksStatus({
        card_ids: requested
    }).then((result)=>{
        let items = result.items || {}

        requested.forEach((card_id)=>{
            setFlags(card_id, items[card_id] || items[card_id + ''] || {}, requested_at)
        })

        refresh()
    }).catch(()=>{}).finally(()=>{
        waiters.forEach((waiter)=>waiter.resolve())
    })
}

function loadStatus(card_ids = [], force = false){
    let needed = card_ids.filter(Boolean).filter((id)=>{
        return force || !status_loaded_at[id] || status_loaded_at[id] < Date.now() - cache_ttl
    })

    if(!needed.length || !hasSession()) return Promise.resolve()

    needed.forEach((id)=>{
        pending_status_ids[id] = true
    })

    return new Promise((resolve)=>{
        pending_status_waiters.push({ids: needed, resolve})

        if(!pending_status_timer){
            pending_status_timer = setTimeout(flushStatusQueue, batch_delay)
        }
    })
}

function addMemory(where, card){
    if(!card || !card.id) return

    Arrays.remove(data[where], card.id)
    Arrays.insert(data[where], 0, card.id)
    setCard(card)
    updateStatusFromData(card.id)
    markTypeTouched(where)
}

function removeMemory(where, card_id){
    Arrays.remove(data[where], card_id)
    updateStatusFromData(card_id)
    rebuildCards()
    markTypeTouched(where)
}

function check(card){
    let card_id = card && card.id ? card.id : 0
    if(!card_id) return ensure({})

    if(!status_cache[card_id]) updateStatusFromData(card_id)

    loadStatus([card_id])

    return status_cache[card_id] || ensure({})
}

function checkAnyNotHistory(status){
    let any = false

    categories.filter((type)=>type !== 'history').forEach((type)=>{
        if(status[type]) any = true
    })

    return any
}

function get(params){
    let type = params.type
    if(categories.indexOf(type) >= 0) loadTypes([type])

    return (data[type] || []).map((id)=>searchCard(id)).filter(Boolean)
}

function full(){
    return data
}

function all(){
    let result = {}

    categories.forEach((type)=>{
        result[type] = get({type})
    })

    return result
}

function clear(where, card){
    if(card) return remove(where, card)

    let current_ids = (data[where] || []).slice()

    data[where] = []
    rebuildCards()
    markTypeTouched(where)
    current_ids.forEach((id)=>updateStatusFromData(id))
    refresh()

    return Api.bookmarksClear({
        type: where
    }).catch(()=>{
        loadTypes([where], true)
    }).then(()=>{
        refresh()
    })
}

function set(where, card, value, limit){
    if(!card || !card.id) return Promise.resolve()

    let excess = []
    let method = value && data[where].indexOf(card.id) >= 0 ? 'added' : 'add'

    if(value){
        addMemory(where, card)

        if(limit){
            excess = data[where].slice(limit)
            excess.forEach((id)=>removeMemory(where, id))
        }
    }
    else removeMemory(where, card.id)

    listener.send(value ? method : 'remove', value ? {where, card} : {where, card, method: 'id'})
    sendState(value ? method : 'remove', where, card)

    return Api.bookmarksSet({
        type: where,
        card_id: card.id,
        value: value,
        data: value ? Utils.clearCard(Arrays.clone(card)) : undefined
    }).catch(()=>{
        loadTypes([where], true)
    }).then(()=>{
        if(!excess.length) return

        excess.forEach((id)=>{
            Api.bookmarksSet({
                type: where,
                card_id: id,
                value: false
            }).catch(()=>{})
        })
    })
}

function add(where, card, limit){
    return set(where, card, true, limit)
}

function remove(where, card){
    return set(where, card, false)
}

function toggle(where, card){
    let found = check(card)

    if(marks.indexOf(where) >= 0){
        let added = marks.find((type)=>found[type])
        if(added && added !== where) remove(added, card)
    }

    if(found[where]) remove(where, card)
    else add(where, card)

    return !found[where]
}

function read(nolisten = false){
    loadTypes(categories)
    refresh(nolisten)
}

function continues(type){
    let result = get({type:'history'})
    let viewed = get({type:'viewed'})
    let thrown = get({type:'thrown'})

    result = result.filter((card)=>{
        return !viewed.find((item)=>item.id == card.id) && !thrown.find((item)=>item.id == card.id)
    })

    result = result.filter((card)=>{
        let is_tv = card.number_of_seasons || card.first_air_date
        let jpan  = card.original_language == 'ja'

        if(type == 'anime') return is_tv && (Utils.containsJapanese(card.original_name || card.name || '') || jpan)
        else if(type == 'tv') return is_tv && !(Utils.containsJapanese(card.original_name || card.name || '') || jpan)
        else return !is_tv
    })

    return Arrays.clone(result.slice(0,19))
}

function syncAll(call){
    loadTypes(categories, true).then(()=>{
        if(call) call()
    }).catch(()=>{
        if(call) call()
    })
}

favorite.listener = listener
favorite.init = Utils.onceInit(init)
favorite.check = check
favorite.add = add
favorite.remove = remove
favorite.toggle = toggle
favorite.get = get
favorite.clear = clear
favorite.continues = continues
favorite.full = full
favorite.checkAnyNotHistory = checkAnyNotHistory
favorite.all = all
favorite.read = read
favorite.syncAll = syncAll

export default favorite
