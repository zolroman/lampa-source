import Utils from './utils/utils'
import Api from './sync_api'
import Bookmarks from './sync_bookmarks'
import Timeline from './sync_timeline'
import Auth from './sync_auth'
import Favorite from './favorite'

let syncing = false

function init(){
    Auth.init()
}

function task(call){
    sync(call)
}

function sync(call){
    if(syncing) return call && call()

    syncing = true

    let finish = ()=>{
        syncing = false
        if(call) call()
    }

    Auth.restore().then(()=>{
        if(!Auth.hasSession()) return false

        return Api.health().then(()=>true)
    }).then((ready)=>{
        if(!ready) return false

        return Api.bootstrapStatus()
    }).then((status)=>{
        if(status === false){
            Favorite.syncAll(finish)
            return
        }

        let payload = {}

        if(status.bookmarks_empty && Bookmarks.hasLocalData()){
            payload.bookmarks = Bookmarks.exportLocal()
        }

        if(status.timeline_empty && Timeline.hasLocalData()){
            payload.timeline = Timeline.exportLocal()
        }

        if(payload.bookmarks || payload.timeline){
            Api.bootstrap(payload).catch(()=>{}).then(()=>{
                Favorite.syncAll(finish)
            })
        }
        else Favorite.syncAll(finish)
    }).catch(finish)
}

export default {
    init: Utils.onceInit(init),
    task,
    sync
}
