import Favorite from '../favorite'
import Timeline from './timeline'
import Lang from '../core/lang'
import Template from './template'

export default {
    onCreate: function(){
        let onCheck = (a)=>{
            Favorite.toggle(a.where, this.data)
        }

        let onSelect = (a)=>{
            onCheck(a)

            this.emit('menuSelect', a, this.html, this.data)
        }

        function drawMenu(){
            let status = Favorite.check(this.data)
            let menu = []
            let itemsCheck = ['book', 'like', 'wath', 'history']
            let itemsMark = ['look', 'viewed', 'scheduled', 'continued', 'thrown']

            itemsCheck.forEach((type)=>{
                menu.push({
                    title: Lang.translate('title_' + type),
                    where: type,
                    checkbox: true,
                    checked: status[type],
                    onCheck
                })
            })

            if(window.lampa_settings.account_use){
                menu.push({
                    title: Lang.translate('settings_cub_status'),
                    separator: true
                })

                itemsMark.forEach((type)=>{
                    menu.push({
                        title: Lang.translate('title_' + type),
                        where: type,
                        picked: status[type],
                        collect: true,
                        onSelect,
                        onDraw: ()=>{}
                    })
                })
            }

            return menu
        }

        this.menu_list.push({
            title: Lang.translate('settings_input_links'),
            menu: drawMenu.bind(this),
        })

        this.listenerFavorite = (e)=>{
            if(e.target == 'favorite'){
                if(e.card){
                    if(e.card.id == this.data.id) this.emit('favorite')
                }
                else this.emit('favorite')
            }
        }

        Lampa.Listener.follow('state:changed', this.listenerFavorite)
    },

    onUpdate: function(){
        this.emit('favorite')
    },

    onAddicon: function(name){
        this.html.find('.card__icons-inner').append(Template.elem('div', {class: 'card__icon icon--' + name}))
    },

    onFavorite: function(){
        let status = Favorite.check(this.data)
        let marker = this.html.find('.card__marker')
        let marks = ['look', 'viewed', 'scheduled', 'continued', 'thrown']

        this.html.find('.card__icons-inner').innerHTML = ''

        if(status.book) this.emit('addicon', 'book')
        if(status.like) this.emit('addicon', 'like')
        if(status.wath) this.emit('addicon', 'wath')
        if(status.history || Timeline.watched(this.data)) this.emit('addicon', 'history')

        let anyMarker = marks.find((type)=>status[type])

        if(anyMarker){
            if(!marker){
                marker = Template.elem('div', {class: 'card__marker', children: [
                    Template.elem('span')
                ]})

                this.html.find('.card__view').append(marker)
            }

            marker.find('span').text(Lang.translate('title_' + anyMarker))
            marker.removeClass(marks.map((type)=>'card__marker--' + type).join(' ')).addClass('card__marker--' + anyMarker)
        }
        else if(marker) marker.remove()
    },

    onDestroy: function(){
        Lampa.Listener.remove('state:changed', this.listenerFavorite)
    }
}
