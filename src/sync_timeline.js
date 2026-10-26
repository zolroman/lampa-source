import Storage from './core/storage/storage'

let file_name    = 'file_view_sync'

function normalizeRoad(road){
    if(typeof road == 'number'){
        return {
            percent: road,
            time: 0,
            duration: 0,
            profile: 0
        }
    }

    return {
        percent: road && road.percent ? road.percent : 0,
        time: road && road.time ? road.time : 0,
        duration: road && road.duration ? road.duration : 0,
        profile: 0
    }
}

function shouldReplace(current, next){
    if(!current) return true
    if(next.time > current.time) return true
    if(next.time == current.time && next.percent > current.percent) return true

    return false
}

function exportLocal(){
    let merged = {}
    let names  = []

    for(let i = 0; i < window.localStorage.length; i++){
        let key = window.localStorage.key(i)

        if(key && key.indexOf('file_view') === 0) names.push(key)
    }

    if(names.indexOf(file_name) < 0) names.push(file_name)

    names.forEach((name)=>{
        let value = Storage.get(name, '{}')

        if(!value || typeof value !== 'object') return

        Object.keys(value).forEach((hash)=>{
            let road = normalizeRoad(value[hash])

            if(shouldReplace(merged[hash], road)) merged[hash] = road
        })
    })

    return merged
}

function hasLocalData(data = exportLocal()){
    return Object.keys(data).length > 0
}

export default {
    init: ()=>{},
    update: (call)=>call && call(),
    flushPending: (call)=>call && call(),
    exportLocal,
    hasLocalData
}
