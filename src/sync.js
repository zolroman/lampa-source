import Utils from './utils/utils'
import Timer from './core/timer'
import Api from './sync_api'
import Bookmarks from './sync_bookmarks'
import Timeline from './sync_timeline'
import Auth from './sync_auth'

let syncing = false

function init(){
    Auth.init()

    Bookmarks.init()
    Timeline.init()

    Timer.add(1000 * 60 * 5, ()=>sync())
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
        if(!Auth.hasSession()) throw {status: 401}

        return Api.health()
    }).then(()=>{
        return Api.bootstrapStatus()
    }).then((status)=>{
        let payload = {}

        if(status.bookmarks && status.bookmarks.empty && Bookmarks.hasLocalData()){
            payload.bookmarks = Bookmarks.exportLocal()
        }

        if(status.timeline && status.timeline.empty && Timeline.hasLocalData()){
            payload.timeline = Timeline.exportLocal()
        }

        let afterBootstrap = ()=>{
            Bookmarks.flushPending(()=>{
                Timeline.flushPending(()=>{
                    Bookmarks.update(()=>{
                        Timeline.update(finish)
                    })
                })
            })
        }

        if(payload.bookmarks || payload.timeline){
            Api.bootstrap(payload).then(afterBootstrap).catch(finish)
        }
        else afterBootstrap()
    }).catch(finish)
}

export default {
    init: Utils.onceInit(init),
    task,
    sync
}
