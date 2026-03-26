import Arrays from './utils/arrays'
import Storage from './core/storage/storage'
import Utils from './utils/utils'
import Favorite from './core/favorite'

const categories = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown']
const marks = ['look', 'viewed', 'scheduled', 'continued', 'thrown']
const originalRead = Favorite.read

function empty(){
    let data = {
        card: []
    }

    categories.forEach((type)=>{
        data[type] = []
    })

    return data
}

function ensure(data){
    let result = Arrays.clone(data || {})

    Arrays.extend(result, empty())

    return result
}

function state(method, type, card, reason = 'update'){
    if(!window.Lampa || !Lampa.Listener) return

    Lampa.Listener.send('state:changed', {
        target: 'favorite',
        reason,
        method,
        type,
        card
    })
}

function refresh(silent = true){
    originalRead.call(Favorite, silent)
}

function readStorage(){
    return ensure(Storage.get('favorite', '{}'))
}

function saveStorage(data){
    Storage.set('favorite', ensure(data))
    refresh(true)
}

function searchCard(data, id){
    return data.card.find((card)=>card.id == id)
}

function hasAny(data, id){
    return categories.some((type)=>Boolean(data[type].find((value)=>value == id)))
}

function checkLocal(card){
    let data = readStorage()
    let result = {
        any: false
    }

    categories.forEach((type)=>{
        result[type] = data[type].find((id)=>id == card.id)

        if(result[type]) result.any = true
    })

    return result
}

function checkAnyNotHistory(status){
    let any = false

    categories.filter((type)=>type !== 'history').forEach((type)=>{
        if(status[type]) any = true
    })

    return any
}

function getLocal(params){
    let data = readStorage()
    let ids = data[params.type] || []
    let result = []

    ids.forEach((id)=>{
        let card = searchCard(data, id)

        if(card) result.push(card)
    })

    return result
}

function fullLocal(){
    return readStorage()
}

function allLocal(){
    let result = {}

    categories.forEach((type)=>{
        result[type] = getLocal({type})
    })

    return result
}

function addLocal(where, card, limit){
    let data = readStorage()
    let find = data[where].find((id)=>id == card.id)

    if(!find){
        Arrays.insert(data[where], 0, card.id)

        Favorite.listener.send('add', {where, card})

        if(!searchCard(data, card.id)) data.card.push(Utils.clearCard(Arrays.clone(card)))

        if(limit){
            saveStorage(data)

            let excess = data[where].slice(limit)

            for(let i = excess.length - 1; i >= 0; i--){
                removeLocal(where, {id: excess[i]})
            }
        }
        else{
            saveStorage(data)
            state('add', where, card)
        }
    }
    else{
        Arrays.remove(data[where], card.id)
        Arrays.insert(data[where], 0, card.id)

        saveStorage(data)

        Favorite.listener.send('added', {where, card})
        state('added', where, card)
    }
}

function removeLocal(where, card){
    let data = readStorage()

    Arrays.remove(data[where], card.id)

    Favorite.listener.send('remove', {where, card, method: 'id'})

    for(let i = data.card.length - 1; i >= 0; i--){
        let element = data.card[i]

        if(!hasAny(data, element.id)){
            Arrays.remove(data.card, element)
            Favorite.listener.send('remove', {where, card: element, method: 'card'})
        }
    }

    saveStorage(data)
    state('remove', where, card)
}

function clearLocal(where, card){
    if(card) removeLocal(where, card)
    else{
        let ids = readStorage()[where].slice()

        for(let i = ids.length - 1; i >= 0; i--){
            let item = searchCard(readStorage(), ids[i])

            if(item) removeLocal(where, item)
        }
    }
}

function toggleLocal(where, card){
    let find = checkLocal(card)

    if(marks.find((type)=>type == where)){
        let added = marks.find((type)=>find[type])

        if(added && added !== where) removeLocal(added, card)
    }

    if(find[where]) removeLocal(where, card)
    else addLocal(where, card)

    return !find[where]
}

Favorite.check = checkLocal
Favorite.add = addLocal
Favorite.remove = removeLocal
Favorite.toggle = toggleLocal
Favorite.get = getLocal
Favorite.clear = clearLocal
Favorite.full = fullLocal
Favorite.all = allLocal
Favorite.checkAnyNotHistory = checkAnyNotHistory
Favorite.read = function(nolisten = false){
    refresh(nolisten)
}

export default Favorite
