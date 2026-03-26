import Storage from './core/storage/storage'
import Timeline from './interaction/timeline'
import Api from './sync_api'

let tracker_name = 'sync_timeline_tracker'
let pending_name = 'sync_timeline_pending'
let file_name    = 'file_view_sync'
let followed     = false

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

function applyLocal(data){
    Storage.set(file_name, data || {}, true)
    Timeline.read()
}

function pending(){
    return Storage.get(pending_name, '{}')
}

function savePending(data){
    Storage.set(pending_name, data, true)
}

function queue(hash, road){
    let data = pending()

    data[hash] = normalizeRoad(road)

    savePending(data)
}

function follow(){
    if(followed) return

    Timeline.listener.follow('update',(e)=>{
        if(e && e.data && e.data.hash) queue(e.data.hash, e.data.road)
    })

    followed = true
}

function flushPending(call){
    let data   = pending()
    let hashes = Object.keys(data)

    if(!hashes.length) return call && call()

    let index = 0

    let next = ()=>{
        if(index >= hashes.length){
            savePending({})
            return call && call()
        }

        let hash = hashes[index]
        let road = normalizeRoad(data[hash])

        Api.timelineUpsert({
            hash,
            percent: road.percent,
            time: road.time,
            duration: road.duration,
            profile: 0
        }).then(()=>{
            index++
            next()
        }).catch(()=>{
            let rest = {}

            hashes.slice(index).forEach((key)=>{
                rest[key] = data[key]
            })

            savePending(rest)
            call && call()
        })
    }

    next()
}

function update(call){
    let current = tracker()
    let needDump = !current.version || current.time < Date.now() - 1000 * 60 * 60 * 24 * 10
    let request  = needDump ? Api.timelineDump() : Api.timelineChangelog(current.version)

    request.then((result)=>{
        let local = needDump ? {} : Storage.get(file_name, '{}')

        Object.keys(result.timelines || {}).forEach((hash)=>{
            local[hash] = normalizeRoad(result.timelines[hash])
        })

        applyLocal(local)

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
