import Arrays from './utils/arrays'
import Utils from './utils/utils'
import Storage from './core/storage/storage'
import Favorite from './favorite'
import Api from './sync_api'

let categories   = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown']
let tracker_name = 'sync_bookmarks_tracker'
let pending_name = 'sync_bookmarks_pending'
let followed     = false

function empty(){
    let result = {
        card: []
    }

    categories.forEach((a)=>{
        result[a] = []
    })

    return result
}

function tracker(){
    return Storage.get(tracker_name, {
        version: 0,
        time: 0
    })
}

function saveTracker(data){
    let current = tracker()

    current.version = typeof data.version == 'number' ? data.version : current.version
    current.time    = typeof data.time == 'number' ? data.time : current.time

    Storage.set(tracker_name, current, true)
}

function ensure(data){
    let result = Arrays.clone(data || {})

    Arrays.extend(result, empty())

    return result
}

function exportLocal(){
    return ensure(Storage.get('favorite', '{}'))
}

function hasLocalData(data = exportLocal()){
    return categories.some((a)=>data[a] && data[a].length)
}

function readLocal(){
    Favorite.read()
}

function insertFront(list, value){
    Arrays.remove(list, value)
    Arrays.insert(list, 0, value)
}

function setCard(data, card){
    let clear = Utils.clearCard(Arrays.clone(card || {}))
    let index = data.card.findIndex((elem)=>elem.id == clear.id)

    if(index >= 0) data.card[index] = clear
    else data.card.push(clear)
}

function hasAny(data, id){
    return categories.some((type)=>Boolean(data[type].find((elem)=>elem == id)))
}

function dropCardIfUnused(data, id){
    if(hasAny(data, id)) return

    data.card = data.card.filter((card)=>card.id != id)
}

function addLocal(data, type, card){
    if(!card || !card.id) return

    insertFront(data[type], card.id)
    setCard(data, card)
}

function removeLocal(data, type, cardId){
    Arrays.remove(data[type], cardId)
    dropCardIfUnused(data, cardId)
}

function rebuildFromDump(rows = []){
    let data = empty()

    rows.forEach((row)=>{
        if(!row || !row.type || !row.card_id) return

        if(!data[row.type]) data[row.type] = []

        data[row.type].push(row.card_id)

        if(row.data && !data.card.find((card)=>card.id == row.card_id)){
            data.card.push(Utils.clearCard(Arrays.clone(row.data)))
        }
    })

    return data
}

function applyLocal(data){
    Storage.set('favorite', ensure(data), true)
    readLocal()
}

function applyChangelog(changelog = []){
    let data = ensure(Storage.get('favorite', '{}'))

    changelog.forEach((change)=>{
        if(!change || !change.action) return

        if(change.action == 'add'){
            let card = change.data || {id: change.card_id}

            addLocal(data, change.type, card)
        }
        else if(change.action == 'remove'){
            removeLocal(data, change.type, change.card_id)
        }
        else if(change.action == 'clear'){
            let type = change.type

            if(type && data[type]){
                data[type].slice().forEach((id)=>removeLocal(data, type, id))
            }
        }
    })

    applyLocal(data)
}

function pending(){
    return Storage.get(pending_name, '[]')
}

function savePending(items){
    Storage.set(pending_name, items, true)
}

function queue(method, where, card){
    let items = pending()

    items.push({
        method,
        where,
        card: Utils.clearCard(Arrays.clone(card || {}))
    })

    savePending(items)
}

function follow(){
    if(followed) return

    Favorite.listener.follow('add,added',(e)=>{
        queue('add', e.where, e.card)
    })

    Favorite.listener.follow('remove',(e)=>{
        if(e.method == 'id') queue('remove', e.where, e.card)
    })

    followed = true
}

function flushPending(call){
    let items = pending()

    if(!items.length) return call && call()

    let index = 0

    let next = ()=>{
        if(index >= items.length){
            savePending([])
            return call && call()
        }

        let item = items[index]
        let request = item.method == 'remove'
            ? Api.bookmarksRemove({
                type: item.where,
                card_id: item.card.id
            })
            : Api.bookmarksAdd({
                type: item.where,
                card_id: item.card.id,
                data: Utils.clearCard(Arrays.clone(item.card))
            })

        request.then(()=>{
            index++
            next()
        }).catch(()=>{
            savePending(items.slice(index))
            call && call()
        })
    }

    next()
}

function update(call){
    let current = tracker()
    let needDump = !current.version || current.time < Date.now() - 1000 * 60 * 60 * 24 * 15
    let request  = needDump ? Api.bookmarksDump() : Api.bookmarksChangelog(current.version)

    request.then((result)=>{
        if(needDump){
            applyLocal(rebuildFromDump(result.bookmarks || []))
        }
        else{
            applyChangelog(result.changelog || [])
        }

        saveTracker({
            version: result.version || current.version || 0,
            time: Date.now()
        })

        call && call()
    }).catch(()=>{
        call && call()
    })
}

export default {
    init: follow,
    update,
    flushPending,
    exportLocal,
    hasLocalData
}
