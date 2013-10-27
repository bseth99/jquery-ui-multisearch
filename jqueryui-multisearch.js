/*!
 * Copyright (c) 2013 Ben Olson (https://github.com/bseth99/jqueryui-multisearch)
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * Dependencies: jQuery, jQuery UI (base widget and position plugin), Underscore (or Lodash)
 *
 */

;(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['jquery', 'underscore'], factory);
    } else {
        // Browser globals
        root.$ = factory( root.$, root._ );
    }
}(this, function ( $, _ ) { 'use strict';

   var regexp_special_chars = new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g');
   function regexp_escape(term) {
      return term.replace(regexp_special_chars, '\\$&');
   }

   $.widget( 'osb.multisearch', {

      optionData: null,
      optionIndex: -1,

      itemData: null,
      itemIndex: -1,

      localCache: null,

      /**
      *  Available options for each widget instance
      */
      options: {

         /*
         *  The data source to search.  Can be a string, function, or array of objects
         *
         *  - A string should be a valid remote datasource.
         *
         *  - A function can implement a data search and should call the passed in
         *    callback with the results:
         *
         *       function ( term, callback ) { ... }
         *
         *  - An array repesents a local dataset and all searches will be done locally
         *    on the contents.
         */
         source: null,

         /*
         *  Hash of options that are used in the $.ajax call on a remote resource.
         *  Only used when source is a string representing the path of the resource.
         *  Currently accepts overrides for dataType and method options.  Also adds
         *  a custom options:
         *
         *     - searchTerm: the parameter name that will contain the search term
         *                   ( ie path/to/resource?term=abc )
         *
         *  Defaults:
         *     searchTerm: 'term',
         *     dataType: 'json',
         *     method: 'GET'
         */
         ajaxOptions: null,

         /*
         *  An array of fields in the result object which represent the unique key for the object.
         *  Used to detect duplicate items.  If not set, will default to ['id']
         */
         keyAttrs: null,

         /*
         *  An array of fields in the result object to search for the entered criteria.
         *  If not set, will default to ['name']
         */
         searchAttrs: null,

         /*
         *  A function that returns an HTML string repesenting the item to add to the suggestion picker
         *  as a search is entered into the input..  The hash returned by the remote server or local cache
         *  is passed to the function.  This can be a Underscore template() function.
         */
         formatPickerItem: function( data ) {
            return '<li><a href="#">'+data.name+'</a></li>';
         },

         /*
         *  A function that returns an HTML string repesenting the item to add to the selected
         *  items list.  Called each time a search term is selected from the suggestion picker or,
         *  when not found items are allowed, a new entry is completed.  The hash from the result
         *  set is passed to the function.  This can be a Underscore template() function.
         */
         formatSelectedItem: function( data ) {
            return '<a href="#">'+data.name+'</a>';
         },

         /*
         *  When adding items that are not found in the suggestion picker, this function is called
         *  to define the object that is expected in the formatSelectedItem() template.  Generally,
         *  you'll leave the keyAttrs attributes null and set the primary display field with the
         *  text from the input box which is passed to the function.
         */
         buildNewItem: function( text ) {
            return { id: null, name: text };
         },

         /*
         *  How many characters need to be typed to trigger a search
         */
         minSearchChars: 2,

         /*
         *  How quickly can successive searches be triggered.  The value is in milliseconds
         *  and uses Underscore's throttle() function to control triggering calls to the
         *  remote resource.  This does not affect local cache searching.
         */
         searchThrottle: 200,

         /*
         *  How many results to show in the picker.  Even if 200 are returned by the server, you
         *  can control how many are actually displayed in the suggestion picker.  Set it to zero
         *  to show everything.  Ensure you enable some kind of scrolling on the element you define
         *  as the picker/picker-list role if you allow longer lists of items.
         */
         maxShowOptions: 5,

         /*
         *  When to start refining a search against the local cache.  Each remote search is saved by term
         *  if the remote result set has less than minLocalCache items in it, each subsequent character typed
         *  will use that result as a basis for searching.  This can reduce the number of hits on the remote
         *  resource and can be fine-tuned to match your needs.  Set it to zero to disable local refinements
         *  against the cache.  If you do use it, make sure any limits on the server side are set high enough
         *  to ensure that a search term that refines the remote search below this threshold will contain all
         *  possible items that could be found if the subsequent searches were run against the server.
         */
         minLocalCache: 50,

         /*
         *  Can items not found in the suggestion picker be added to the seleced item list.  If allowed,
         *  buildNewItem() will be called to allow setting defaults on the object that represents the
         *  search data to be prefilled before calling formatSelectedItem().  The adding and added events
         *  will have the notfound flag set to true when an item will be added that in not in the picker.
         */
         preventNotFound: false,

         /*
         *  Using the keyAttrs, should duplicates be prevented.  A duplicate event is triggered if one is found
         *  allowing custom UI logic to be defined externally.  Otherwise, nothing will happen.  The suggestion
         *  picker will remain open and it will appear that the widget is not responding.  Items that are not
         *  found in the picker but are added to the selected item list will not be considered a duplicate
         *  unless you provide custom logic during adding that would assign a key.
         */
         preventDuplicates: true,

         /*
         *  Automatically resize the input box to match the text.  Helpful for inline/floating elements so
         *  the input only wraps as needed.  Disable if using block elements that you want to fill the
         *  parent space.
         */
         useAutoWidth: true,

         /*
         *  Use jQueryUI.position plugin to position the picker box relative to the input control.  The default is the
         *  basic drop-down menu box under the input entry box.  Depending on the structure, you may want to adjust this
         *  setting.
         */
         pickerPosition: {
            my: 'left top',
            at: 'left bottom',
         },

         /*
         *  Where is the input relative to the item list.  Determines how the keyboard navigation
         *  moves through the items and where new items are added.  Valid values are "start" and "end"
         *  defaults to "end".  Depending on where you position the input box, adjust this setting
         *  so the UI interactions make sense.
         */
         inputPosition: 'end',

         /*
         *  For each field defined in searchAttrs, search for the input text using the function below.  This is used
         *  for both local cache searches and hit highlighting.  It should match with the search method from the remote.
         *  The default is to look for the search string anywhere in the target field.  If you want to match only from
         *  the leading edge of the field, you'll need to override this function.
         */
         localMatcher: function( needle, haystack ) { return haystack.toLowerCase().indexOf( needle.toLowerCase() ) > -1; }
      },

      /**
      *
      *  API instance methods.  These methods all suppress any events that would
      *  normally be triggered by user interaction.
      *
      ***/

      /*
      *  Getter/Setter for list of selected items.  Use it to retreive the list of items
      *  entered by the user or seed the list with existing items (from a database, etc).
      *
      *  Getting the value returns a shallow clone of the objects in the item list.  If
      *  you're using nested objects from a shared dataset, be aware you may be referencing
      *  them in the returned set.
      *
      *  Setting the value will destory the current selections.  If you want more control,
      *  use add/remove to selectively update the list.
      *
      */
      value: function( items ) {

         var self = this;

         if ( items ) {
            this.remove();
            _.each( items, function( m ) { self.add( m ); });
         } else {
            return _.map( this.itemData, function( i ) { return _.clone( i ); });
         }
      },

      /*
      *  Add an item to the selection list.  Optional second arguement can be used to specify
      *  the position to insert the item.  If the item already exists, it will be merged
      *  and trigger rendering the content of the item again such that updated data can be
      *  applied to the list.
      */
      add: function( item, pos ) {
         var options = { silent: true },
             idx;

         if ( typeof(pos) !== 'undefined' ) options.at = pos;

         if ( ( idx = this._findByKeys( item ) ) > -1 ) {
            this._removeItem( idx );
            if ( typeof(options.at) === 'undefined' || options.at === null )
               options.at = idx;
         }

         this._addItem( item, options );
      },

      /*
      *  Remove one or all items form the selected list:
      *
      *     - No arguements will remove everything
      *     - Pass an Integer representing the ordinal index of the item to remove
      *     - Pass an Object containing the keys of the item to remove.
      */
      remove: function( item ) {
         var idx;

         if ( arguments.length === 0 ) {

            // Clear
            this._getSelectedChildren().remove();
            this.itemData = [];
            this.itemIndex = -1;
         } else if ( _.isObject( item ) ) {

            // Lookup by keys
            if ( ( idx = this._findByKeys( item ) ) > -1 )
               this._removeItem( idx, { silent: true } );

         } else {

            // Number index
            this._removeItem( item, { silent: true } );
         }
      },


      /*
      *  Available events.  Uses the standard jQuery UI interface for triggering events.  You can either
      *  define a callback in the options hash or listen to the event by binding to multisearch + event name
      *  ie $.on( 'multisearchadding', ... ).
      *
      *  Handler function will receive an event and ui argument.  The ui object is defined below with each
      *  event that is triggered.
      *
      *
      *     - duplicate:  trigger when preventDuplicates is true and a selected item from the picker matches
      *                   an item already in the item list based on keyAttrs
      *
      *        ui: {
      *           existing:  Object representing the duplicate already present in the item list
      *           adding:  Object representing the item that is attempting to be added
      *        }
      *
      *
      *     - adding:  triggered before actually adding the item to the item list.  Return false to
      *                prevent the the action.  You can modify data to affect what is passed to the
      *                template function and retained in the item list.
      *
      *        ui: {
      *           data:  Object containing the selected item
      *           notfound:  Flag indicating whether the item was found in the picker list
      *        }
      *
      *
      *     - added:  once the item is added, this event is triggered with the data and element
      *
      *        ui: {
      *           data:  Object containing the selected item
      *           element:  jQuery object of the newly added element representing the data in the UI
      *        }
      *
      *
      *     - removing:  prior to removing the item, this event is triggered to allow canceling
      *                  the operation by returning false
      *
      *        ui: {
      *           data:  Object containing the selected item
      *        }
      *
      *
      *     - removed:  upon removing the item, this event is triggered
      *
      *        ui: {
      *           data:  Object containing the selected item
      *        }
      *
      *
      *     - searching:  triggered before searching but immediately after displaying the picker
      *
      *        ui: {
      *           term:  String that will be used in the search
      *           picker:  jQuery object representing the main picker container element
      *        }
      *
      *
      *     - searched: triggered after searching has completed and results have been returned by the source
      *
      *        ui: {
      *           term:  String that will be used in the search
      *           picker:  jQuery object representing the main picker container element
      *           list: Array of objects returned by the search
      *        }
      *
      *
      *     - itemaction: triggered when an element with data-action is clicked in the item list
      *
      *        ui: {
      *           data:  Object containing the selected item
      *           element:  jQuery object of the element representing the data in the UI
      *        }
      *
      *
      *     - itemselect: triggered when an item is clicked in the item list (no data-action defined)
      *
      *        ui: {
      *           data:  Object containing the selected item
      *           element:  jQuery object of the element representing the data in the UI
      *        }
      *
      *
      *     Hover/Active events are triggered either when the user uses the mouse (hover/click) or
      *     uses the keyboard to navigate (arrows, space bar).  A handler can return false to prevent
      *     the default action which simply changes classes on the elements.  Each event provides the
      *     following ui object:
      *
      *        ui: {
      *           target:  A jQuery object representing the item receiving the event
      *           siblings:  jQuery object of the siblings of the target filtering out any elements that
      *                      do not have the data-role defined.  Generally, you need to remove classes from
      *                      the siblings when adding them to the target.
      *        }
      *
      *     Here is the list of interaction events:
      *
      *     - selectedactive:  When a selected item is clicked or selected with the space bar
      *     - selectedhoverin:  When mousing into an item or using the arrows to navigate
      *     - selectedhoverout:  When leaving a selected item
      *     - pickerhoverin: When mouseover or arrows to a suggested item in the picker list
      *     - pickerhoverout: When leaving the item
      *
      */

      _findByKeys: function( item ) {
         var keys = this.options.keyAttrs,
             vals, find, idx = -1;

         vals = _.values( _.pick( item, keys ) );
         if ( vals.length == keys.length ) {

            find = _.findWhere( this.itemData, _.object( keys, vals ) );
            if ( find ) {
               idx = _.indexOf( this.itemData, find );
            }
         }

         return idx;
      },

      _create: function() {

         var opt = this.options;

         opt.keyAttrs = opt.keyAttrs || [ 'id' ];
         opt.searchAttrs = opt.searchAttrs || [ 'name' ];

         this.localCache = {};
         this.optionData = [];
         this.itemData = [];
         this.search_text = '';

         this.element.addClass( 'osb-multisearch' );

         this.$input = this.element.find( '[data-role="input"]' ).attr({ 'autocomplete': 'off',  'autocapitalize': 'off', 'spellcheck': 'false'  });
         this.$picker = this.element.find( '[data-role="picker"]' ).css( 'position', 'absolute' ).hide();
         this.$pickerList = this.element.find( '[data-role="picker-list"]' );
         this.$itemList = this.element.find( '[data-role="selected-list"]' );

         this.$input.on( 'keydown.multisearch', $.proxy( this, '_processInput' ) );

         this.$picker.on( 'click.multisearch mouseenter.multisearch mouseleave.multisearch', '[data-role="picker-item"]', $.proxy( this, '_processPicker' ) );
         this.$itemList.on( 'click.multisearch mouseenter.multisearch mouseleave keydown.multisearch', '[data-role="selected-item"]', $.proxy( this, '_processSelected' ) );

         this._initAutoWidth();
         this._initRemote();

         var self = this;
         $( document ).on( 'click.multisearch', function( event ) {

            if ( self.element.has( event.target ).length === 0 )
               self._hidePicker();
         });
      },

      _initRemote: function() {

         var self = this,
             opt = this.options;

         var cb = function( term, data ) {

            self._trigger( 'searched', null, { term: term, picker: self.$picker, list: data } );

            self.localCache[term] = data;
            self.optionData = data.slice( 0, opt.maxShowOptions );
            self._renderPickerItems();
         }

         if ( typeof( opt.source ) == 'string' ) {

            opt.ajaxOptions =
               opt.ajaxOptions || {
                  searchTerm: 'term',
                  dataType: 'json',
                  method: 'GET'
               };

            this._remoteSearch = _.throttle( function() {

                  if ( self.localCache[self.search_text] ) {
                     cb( self.search_text, self.localCache[self.search_text] );
                  } else {

                     if ( self._xhr )
                        self._xhr.abort();

                     self._xhr =
                        $.ajax({
                           url: opt.source,
                           data: opt.ajaxOptions.searchTerm+'='+self.search_text,
                           dataType: opt.ajaxOptions.dataType,
                           method: opt.ajaxOptions.method
                        }).done( _.partial( cb, self.search_text ) );
                  }
               },
               opt.searchThrottle,
               { leading: false }
            );

         } else if ( $.isFunction( opt.source ) ) {

            this._remoteSearch = _.throttle( function() {

                  // Need to capture the text as of now..
                  if ( self.localCache[self.search_text] ) {
                     cb( self.search_text, self.localCache[self.search_text] );
                  } else {
                     opt.source.call( self, self.search_text, _.partial( cb, self.search_text ) );
                  }
               },
               opt.searchThrottle,
               { leading: false }
            );

         } else {

            this._remoteSearch = function() {

               var results = _.filter( opt.source, function ( item ) { return self._matcher.call( self, item ); });

               self.optionData = results.slice( 0, opt.maxShowOptions );
               self._renderPickerItems();
            }
         }

      },

      _initAutoWidth: function() {

         if ( this.options.useAutoWidth ) {

            this.$sizer = $( '<div></div>' )
               .css({
                  position: 'absolute',
                  top: -9999,
                  left: -9999,
                  width: '100%',
                  fontSize: this.$input.css( 'font-size' ),
                  fontFamily: this.$input.css( 'font-family' ),
                  fontWeight: this.$input.css( 'font-weight' ),
                  letterSpacing: this.$input.css( 'letter-spacing' ),
                  paddingLeft: this.$input.css( 'padding-left' ),
                  paddingRight: this.$input.css( 'padding-right' ),
                  marginLeft: this.$input.css( 'margin-left' ),
                  marginRight: this.$input.css( 'margin-right' ),
                  whiteSpace: 'nowrap'
                }).insertAfter( this.$input );

            // The first call will initialize the rest since we need to be sure
            // the elements are in the DOM.
            this.$input.on( 'keyup', $.proxy( this, '_autoSizeInput' ) );

         }

      },

      _destroy: function() {

         this.element.removeClass( 'osb-multisearch' );

         $( document ).off( '.multisearch' );
         this.$input.off( '.multisearch' );
         this.$picker.off( '.multisearch' );
         this.$itemList.off( '.multisearch' );

         this.$sizer.remove();
         this.$pickerList.html('');
         this._getSelectedChildren().remove();
         this.$picker.show();

         this._remoteSearch = null;

         this.localCache = null;
         this.optionData = null;
         this.itemData = null;
      },

      _processInput: function ( event ) {

         switch( event.keyCode ) {

             case jQuery.ui.keyCode.UP:
             case jQuery.ui.keyCode.DOWN:
             case jQuery.ui.keyCode.LEFT:
             case jQuery.ui.keyCode.RIGHT:

                if( this.$input.val().length ) {

                  if ( event.keyCode === jQuery.ui.keyCode.DOWN || event.keyCode === jQuery.ui.keyCode.RIGHT ) {
                     if ( this.optionIndex < this.options.maxShowOptions - 1 )
                        this._overPickerItem( this._getPickerChildren().eq( ++this.optionIndex ) );
                  } else {
                     if ( this.optionIndex > 0 )
                        this._offPickerItem( this._getPickerChildren().eq( --this.optionIndex ) );
                  }

                  return false;
                } else {

                  if ( event.keyCode === jQuery.ui.keyCode.DOWN || event.keyCode === jQuery.ui.keyCode.RIGHT ) {
                     this._gotoPrevItem();
                  } else {
                     this._gotoNextItem();
                  }

                  return false;
                }

                break;

             case jQuery.ui.keyCode.SPACE:

                if( !this.$input.val().length ) {
                   if ( this.itemIndex > -1 && this.itemIndex < this.itemData.length ) {
                     this._getSelectedChildren().eq( this.itemIndex ).trigger( 'click' );
                   } else {
                     this._clearSelectedItem();
                   }

                  return false;
                }

                break;

             case jQuery.ui.keyCode.DELETE:

                if( !this.$input.val().length ) {
                   if ( this.itemIndex > -1 && this.itemIndex < this.itemData.length ) {

                      var e = jQuery.Event( 'keydown' );
                      e.keyCode = jQuery.ui.keyCode.DELETE;
                      this._getSelectedChildren().eq( this.itemIndex ).trigger( e );
                   }

                   return false;
                }

                break;

             case jQuery.ui.keyCode.BACKSPACE:

                 if( !this.$input.val().length ) {
                     // No more characters.  Start deleting existing
                     // items that have been selected.
                     if ( this.options.inputPosition == 'end' ) {
                        if ( this.itemData.length > 0 ) {
                           if ( this.itemIndex > -1 && this.itemIndex < this.itemData.length ) {
                              this._removeSelectedItem();
                           } else {
                              this.itemIndex = this.itemData.length - 1;
                              this._getSelectedChildren().eq( this.itemIndex ).trigger( 'mouseenter' );
                           }
                           this._hidePicker();
                        }
                     }
                     return false;
                 } else if( this.$input.val().length === 1 ) {
                     // The last character is going to be
                     // deleted.  Hide the picker.
                     this._hidePicker();
                 } else {
                     // New search string
                     _.defer( $.proxy( this, '_search' ) );
                 }
                 break;

             case jQuery.ui.keyCode.TAB:
             case jQuery.ui.keyCode.ENTER:

               if ( this.search_text.length > 0 ) {

                  if( this.optionIndex > -1 ) {
                     this._addSelectedItem();
                  } else {

                     if ( !this.options.preventNotFound ) {
                        this._addItem( this.options.buildNewItem( this.search_text ) );
                     }
                  }

                  this._clearSelectedItem();
                  event.stopPropagation();
                  event.preventDefault();
                  return false;
               }

               break;

             case jQuery.ui.keyCode.ESCAPE:

               this._hidePicker();
               return true;

             default:
                 if( String.fromCharCode( event.which ) ) {
                     this._clearSelectedItem();
                     _.defer( $.proxy( this, '_search' ) );
                 }
                 break;
         }

      },

      _processPicker: function( event ) {

         var $currentTarget = $( event.currentTarget );

         switch( event.type ) {

            case 'click':

               this.optionIndex = this._getPickerChildren().index( $currentTarget );
               this._addSelectedItem();
               this.$input.focus();

               break;

            case 'mouseenter':

               this._overPickerItem( $currentTarget );
               break;

            case 'mouseleave':

               this._offPickerItem( $currentTarget );
               break;
         }
      },

      _processSelected: function( event ) {

         var $target = $( event.target ),
             $currentTarget = $( event.currentTarget ),
             action;

         switch( event.type ) {

            case 'click':

               this.itemIndex = this._getSelectedChildren().index( $currentTarget );
               this._activeSelectedItem( $currentTarget );

               if ( !$target.is( '[data-action]' ) )
                  $target = $target.parents( '[data-action]' ).first();

               if ( $target.length && $currentTarget.has( $target ).length ) {

                  action = $target.attr( 'data-action' );
                  if ( this._trigger( 'itemaction', null, { action: action, data: this.itemData[this.itemIndex], element: $currentTarget } ) ) {

                     switch ( action ) {

                        case 'remove':

                           var e = jQuery.Event( 'keydown' );
                           e.keyCode = jQuery.ui.keyCode.DELETE;
                           $currentTarget.trigger( e );

                           event.stopPropagation();
                           event.preventDefault();
                           return false;
                     }

                  }
               } else {
                  this._trigger( 'itemselect', null, { data: this.itemData[this.itemIndex], element: $currentTarget } )
               }

               break;

            case 'mouseenter':

               this._overSelectedItem( $currentTarget );
               break;

            case 'mouseleave':

               this._offSelectedItem( $currentTarget );
               break;

            case 'keydown':

               switch( event.keyCode ) {


                  case jQuery.ui.keyCode.UP:
                  case jQuery.ui.keyCode.DOWN:
                  case jQuery.ui.keyCode.LEFT:
                  case jQuery.ui.keyCode.RIGHT:

                     if ( event.keyCode === jQuery.ui.keyCode.DOWN || event.keyCode === jQuery.ui.keyCode.RIGHT ) {
                        this._gotoPrevItem();
                     } else {
                        this._gotoNextItem();
                     }

                     return false;

                  case jQuery.ui.keyCode.SPACE:

                     if ( this.itemIndex > -1 && this.itemIndex < this.itemData.length ) {
                        this._getSelectedChildren().eq( this.itemIndex ).trigger( 'click' );
                     }
                     return false;

                  case jQuery.ui.keyCode.BACKSPACE:
                  case jQuery.ui.keyCode.DELETE:

                     if ( this.itemIndex > -1 && this.itemIndex < this.itemData.length ) {
                        this._removeSelectedItem();
                        this.$input.focus();
                     }

                     event.stopPropagation();
                     event.preventDefault();
                     return false;
               }

               break;
         }
      },

      _addSelectedItem: function() {

         var item = this.optionData[ this.optionIndex ];

         this._addItem( _.clone( item ) );

         this.optionIndex = -1;
      },

      _addItem: function( item, options ) {

         var opt = options || {},
             where = this.options.inputPosition,
             addOk = true,
             notFound = false,
             silent = opt.silent || false,
             at = opt.at === null || typeof( opt.at ) == 'undefined' ? ( where == 'start' ? 0 : this.itemData.length ) : opt.at,
             keys = this.options.keyAttrs,
             idx, $el;

         if ( item ) {

            notFound = !_.values( _.pick( item, keys ) ).join('').length;
            if ( !notFound && this.options.preventDuplicates ) {

               addOk = ( idx = this._findByKeys( item ) ) == -1;

               if ( !addOk )
                  this._trigger( 'duplicate', null, { existing: this.itemData[idx], adding: item } );

            }

            if ( addOk ) {

               if ( silent || this._trigger( 'adding', null, { data: item, notfound: notFound } ) ) {

                  $el = $( this.options.formatSelectedItem( item ) ).attr({ 'data-role': 'selected-item', 'tabIndex': -1 });
                  if ( at == this.itemData.length ) {

                     if ( this.$itemList.has( this.$input ).length > 0 ) {

                        if ( where == 'start' )
                           $el.insertAfter( this.$input );
                        else
                           $el.insertBefore( this.$input );

                     } else {
                        this.$itemList.append( $el );
                     }

                     this.itemData.push( item );

                  } else {
                     $el.insertBefore( this._getSelectedChildren().eq( at ) );
                     this.itemData.splice( at, 0, item );
                  }

                  this.$input.val('');
                  this.search_text = '';
                  this._hidePicker();

                  if ( this.itemIndex == -1 || this.itemIndex == this.itemData.length - 1 ) this._gotoFirstItem();
                  else if ( at <= this.itemIndex ) this.itemIndex++;

                  if ( !silent )
                     this._trigger( 'added', null, { data: item, element: $el, notfound: notFound } );

               }
            }
         }
      },

      _removeSelectedItem: function() {

         this._removeItem( this.itemIndex );

      },

      _removeItem: function( idx, options ) {

         var opt = options || {},
             silent = opt.silent || false,
             item = this.itemData[ idx ];

         if ( item ) {

            if ( silent || this._trigger( 'removing', null, { data: item } ) ) {

               this._getSelectedChildren().eq( idx ).remove();
               this.itemData.splice( idx, 1 );

               if ( this.itemData.length > 0 ) {

                  if ( idx < this.itemIndex )
                     this.itemIndex--;

                  if ( this.itemIndex > -1 && this.itemIndex < this.itemData.length ) {
                     this._overSelectedItem( this._getSelectedChildren().eq( this.itemIndex ) );
                  }

               }

               if ( !silent )
                  this._trigger( 'removed', null, { data: item } );
            }
         }
      },

      _getSelectedChildren: function() {
         return this.$itemList.children( '[data-role="selected-item"]' );
      },

      _clearSelectedItem: function() {
         this.$itemList.children().removeClass( 'active hover' );
         this._gotoFirstItem();
      },

      _activeSelectedItem: function( $target ) {

         // Allow externally managed styling, otherwise, fallback to defaults.
         if ( this._trigger( 'selectedactive', null, { target: $target, siblings: $target.siblings( '[data-role="selected-item"]' ) } ) ) {
            $target.addClass( 'active' ).siblings( '[data-role="selected-item"]' ).removeClass( 'active' );
         }
      },

      _overSelectedItem: function( $target ) {
         if ( this._trigger( 'selectedhoverin', null, { target: $target, siblings: $target.siblings( '[data-role="selected-item"]' ) } ) ) {
            $target.addClass( 'hover' ).siblings( '[data-role="selected-item"]' ).removeClass( 'hover' );
         }
      },

      _offSelectedItem: function( $target ) {

         if ( this._trigger( 'selectedhoverout', null, { target: $target, siblings: $target.siblings( '[data-role="selected-item"]' ) } ) ) {
            $target.removeClass( 'hover' );
            if ( this.itemIndex > -1 )
               this._overSelectedItem( this._getSelectedChildren().eq( this.itemIndex ) );
         }
      },

      _gotoPrevItem: function() {

         if ( this.itemIndex < this.itemData.length - 1 ) {
            this.$itemList.children().not( this.$input ).eq( ++this.itemIndex ).trigger( 'mouseenter' );
         } else if ( this.itemIndex == this.itemData.length - 1 ) {
            this.itemIndex++;
            this.$itemList.children().removeClass( 'hover' );
         }
      },

      _gotoNextItem: function() {

         if ( this.itemIndex > 0 ) {
            this.$itemList.children().not( this.$input ).eq( --this.itemIndex ).trigger( 'mouseenter' );
         } else if ( this.itemIndex === 0 ) {
            this.itemIndex--;
            this.$itemList.children().removeClass( 'hover' );
         }
      },

      _gotoFirstItem: function() {
         // Relative to input's position
         if ( this.options.inputPosition == 'start' )
            this.itemIndex = -1;
         else
            this.itemIndex = this.itemData.length;
      },

      _renderPickerItems: function() {

         var self = this;

         // I guess this means nothing else can be
         // placed in here ...
         this.$pickerList.html('');
         this.optionIndex = -1;

         if ( this.optionData.length > 0 ) {

            _.each( this.optionData, function( item ) {
               self.$pickerList.append( $( self.options.formatPickerItem( self._formatter( item ) ) ).attr( 'data-role', 'picker-item' ) );
            });

            this._showPicker();

            if ( this.options.preventNotFound || this.optionData.length == 1 ) {
               this.optionIndex = 0;
               this._overPickerItem( this._getPickerChildren().eq( 0 ) );
            }


         } else {
            this._hidePicker();
         }

      },

      _showPicker: function() {

         this.$picker.show();

         this.$picker.position({
            my: this.options.pickerPosition.my,
            at: this.options.pickerPosition.at,
            of: this.$input
         });

      },

      _hidePicker: function() {
         this.$picker.hide();
      },

      _getPickerChildren: function() {
         return this.$pickerList.children( '[data-role="picker-item"]' );
      },

      _overPickerItem: function( $target ) {
         if ( this._trigger( 'pickerhoverin', null, { target: $target, siblings: $target.siblings( '[data-role="picker-item"]' ) } ) ) {
            $target.addClass( 'hover' ).siblings( '[data-role="picker-item"]' ).removeClass( 'hover' );
         }
      },


      _offPickerItem: function( $target ) {

         if ( this._trigger( 'pickerhoverout', null, { target: $target, siblings: $target.siblings( '[data-role="picker-item"]' ) } ) ) {
            $target.removeClass( 'hover' );
            if ( this.optionIndex > -1 )
               this._overPickerItem( this._getPickerChildren().eq( this.optionIndex ) );
         }
      },


      _formatter: function ( data ) {

         var self = this,
             text = this.search_text,
             item = _.clone( data );

         if ( text.length > 0 ) {

            _.each( this.options.searchAttrs, function( d ) {

               if ( item[d] && self.options.localMatcher( text, item[d] ) ) {

                  // TODO: Figure out how to allow this to be overridden.
                  // as it stands now, this will find substrings that
                  // might not match what localMatcher thought should
                  // match...
                  item[d] = item[d].replace(
                                       new RegExp(
                                           '(?![^&;]+;)(?!<[^<>]*)(' +
                                           regexp_escape( text ) +
                                           ')(?![^<>]*>)(?![^&;]+;)', 'gi'),
                                           '<strong>$1</strong>');
               }
            });
         }

         return item;
      },

      _matcher: function ( item ) {

         var self = this;

         return (
                  this.search_text.length === 0 ||
                  ( this.search_text.length > 0 &&
                    _.any(
                      _.values(
                        _.pick( item, self.options.searchAttrs )
                      ), function( s ) {
                         return self.options.localMatcher( self.search_text, s )
                      }
                    )
                  )
                );
      },

      _search: function() {
         var self = this, cache, search;

         search = this.search_text = this.$input.val();
         if ( this.search_text.length < this.options.minSearchChars ) return;

         search = search.length > 1 ? search.slice( 0, search.length - 1 ) : null;
         if ( search && this.localCache[search] && this.localCache[search].length <= this.options.minLocalCache ) {

            cache = _.filter( this.localCache[search], function ( item ) { return self._matcher.call( self, item ); });

            this.localCache[this.search_text] = cache;
            this.optionData = cache.slice( 0, this.options.maxShowOptions );
            this._renderPickerItems();

         } else {

            this._showPicker();
            this._trigger( 'searching', null, { term: this.search_text, picker: this.$picker } );

            this._remoteSearch();

         }
      },

      _autoSizeInput: function() {

         var text = this.$input.val(),
             max = this.maxInputWidth;

         // First time through, make some min/max calcs
         // TODO: What if the element resizes, how to reset?
         if ( !this.maxInputWidth ) {
            this.maxInputWidth = this.$sizer.width();
            this.$sizer.css( 'width', 'auto' );
         }

         this.$sizer.html( (regexp_escape( text ) || regexp_escape( this.$input.attr( 'placeholder' ) ) || 'MMMMMMMMMMMMMMMM').replace(/ /g, '&nbsp;') );
         this.$input.css({ width: Math.min( 100, Math.ceil( ( Math.max( this.minInputWidth, this.$sizer.outerWidth( true ) + 25 ) ) / max * 100 ) )+'%' });

         if ( !this.minInputWidth )
            this.minInputWidth = this.$input.width();
      }

   });

   return $;

}));
