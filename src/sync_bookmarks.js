import Storage from './core/storage/storage'

let categories = ['like', 'wath', 'book', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown']

function empty(){
    let result = {
        card: []
    }

    categories.forEach((type)=>{
        result[type] = []
    })

    return result
}

function ensure(data){
    return Object.assign(empty(), data || {})
}

function exportLocal(){
    return ensure(Storage.get('favorite', '{}'))
}

function hasLocalData(data = exportLocal()){
    return categories.some((type)=>data[type] && data[type].length)
}

export default {
    init: ()=>{},
    update: (call)=>call && call(),
    flushPending: (call)=>call && call(),
    exportLocal,
    hasLocalData
}
