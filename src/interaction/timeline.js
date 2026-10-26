import Template from './template'
import Utils from '../utils/utils'
import Subscribe from '../utils/subscribe'
import Activity from './activity/activity'
import Api from '../sync_api'
import SyncAuth from '../sync_auth'

let listener = Subscribe()
let viewed = {}
let loaded_at = {}
let inflight = {}
let cache_ttl = 3000

function init(){
    read()
}

function hasSession(){
    return SyncAuth.hasSession()
}

function read(no_nolisten = false){
    listener.send('read', {data: viewed})

    if(no_nolisten) return

    Lampa.Listener.send('state:changed', {
        target: 'timeline',
        reason: 'read',
        viewed
    })
}

function filename(){
    return 'file_view_sync'
}

function normalizeRoad(road){
    if(typeof road == 'number'){
        return {
            duration: 0,
            time: 0,
            percent: road,
            profile: 0
        }
    }

    return {
        duration: road && road.duration ? road.duration : 0,
        time: road && road.time ? road.time : 0,
        percent: road && road.percent ? road.percent : 0,
        profile: road && road.profile ? road.profile : 0
    }
}

function applyRoad(hash, road, silent = false){
    viewed[hash] = normalizeRoad(road)
    loaded_at[hash] = Date.now()

    if(silent) return

    let layers = [].concat(Activity.renderLayers())
    layers.push($(document))

    layers.forEach((layer)=>{
        let line = $('.time-line[data-hash="'+hash+'"]', layer).toggleClass('hide', viewed[hash].percent ? false : true)

        $('> div', line).css({
            width: viewed[hash].percent + '%'
        })

        $('.time-line-details[data-hash="'+hash+'"]', layer).each(function(){
            let f = format(viewed[hash])

            $(this).find('[a="t"]').text(f.time)
            $(this).find('[a="p"]').text(f.percent)
            $(this).find('[a="d"]').text(f.duration)
            $(this).toggleClass('hide', viewed[hash].duration ? false : true)
        })
    })

    listener.send('update', {data:{ hash, road: viewed[hash] }})

    Lampa.Listener.send('state:changed', {
        target: 'timeline',
        reason: 'update',
        data:{ hash, road: viewed[hash] }
    })
}

function load(hashes = [], force = false){
    let needed = hashes.filter(Boolean).filter((hash)=>{
        return force || !loaded_at[hash] || loaded_at[hash] < Date.now() - cache_ttl
    })

    if(!needed.length || !hasSession()) return Promise.resolve()

    let key = needed.slice().sort().join(',')
    if(inflight[key]) return inflight[key]

    inflight[key] = Api.timelineGet({
        hashes: needed
    }).then((result)=>{
        let roads = result.timelines || {}

        needed.forEach((hash)=>{
            let road = roads[hash] || roads[hash + ''] || {percent: 0, time: 0, duration: 0}
            viewed[hash] = normalizeRoad(road)
            loaded_at[hash] = Date.now()
        })

        read()
    }).catch(()=>{}).finally(()=>{
        delete inflight[key]
    })

    return inflight[key]
}

function update(params){
    if(params.hash == 0) return

    let road = normalizeRoad(viewed[params.hash])

    road.percent = typeof params.percent !== 'undefined' ? params.percent : road.percent
    road.time = typeof params.time !== 'undefined' ? params.time : road.time
    road.duration = typeof params.duration !== 'undefined' ? params.duration : road.duration
    road.profile = typeof params.profile !== 'undefined' ? params.profile : road.profile

    applyRoad(params.hash, road)

    Api.timelineSet({
        hash: params.hash,
        percent: road.percent,
        time: road.time,
        duration: road.duration
    }).catch(()=>{
        load([params.hash], true)
    })
}

function view(hash){
    console.log('timeline view', hash)
    let road = normalizeRoad(viewed[hash])

    load([hash])

    listener.send('view', {data: { hash, road }})

    return {
        hash: hash,
        percent: road.percent,
        time: road.time,
        duration: road.duration,
        profile: road.profile,
        handler: (percent,time,duration) => update({ hash, percent, time, duration, profile: road.profile })
    }
}

function render(params){
    let line = Template.get('timeline', params)

    line.toggleClass('hide',params.percent ? false : true)

    return line
}

function details(params, str = ''){
    let line = Template.get('timeline_details', format(params))

    if(str) line.prepend(str)

    line.attr('data-hash', params.hash)

    line.toggleClass('hide',params.duration ? false : true)

    return line
}

function watched(card, return_time = false){
    if(card.original_name){
        let max  = 24
        let list = []
        
        for(let i = 1; i <= max; i++){
            let time = view(Utils.hash([1, i, card.original_name].join('')))

            if(time.percent) {
                list.push({ep: i, view: time})
            }
        }

        return return_time ? list : list.length
    }
    else{
        let time = view(Utils.hash(card.original_title))

        return return_time ? time : time.percent
    }
}

function watchedEpisode(card, season, episode, return_time = false){
    let time = view(Utils.hash([season, season > 10 ? ':' : '',episode,card.original_name || card.original_title].join('')))
    return return_time ? time : time.percent
}

function format(params){
    return {
        percent: params.percent + '%',
        time: Utils.secondsToTimeHuman(params.time),
        duration: Utils.secondsToTimeHuman(params.duration)
    }
}

export default {
    init: Utils.onceInit(init),
    read,
    listener,
    render,
    update,
    view,
    details,
    format,
    watched,
    watchedEpisode,
    filename,
    load
}
