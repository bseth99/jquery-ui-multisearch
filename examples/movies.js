
   var MovieModel = Backbone.Model.extend({

      defaults: {

         id: '',
         title: '',
         release_date: '',
         studio: '',
         mpaa_rating: '',
         critics_rating: '',
         critics_score: '',
         audience_rating: '',
         audience_score: '',
         genre: '',
         cast: '',
         image: '',
         synopsis: '',
         link: ''

      },

      url: function () {
         return _.result(this.collection, 'urlRoot')+'movies/'+this.id+'.json?apikey='+this.collection.apikey;
      },

      parse: function ( res ) {
         var rdt = moment( ( res.release_dates && res.release_dates.theater ? res.release_dates.theater : moment().format('YYYY-MM-DD') ), 'YYYY-MM-DD' );

         rdt.day(5);

         return {
               id: ''+res.id,
               title: res.title,
               release_date: rdt.format('YYYY-MM-DD'),
               release_date_pretty: rdt.format('MMMM Do'),
               year: rdt.format('YYYY'),
               studio: res.studio || '',
               mpaa_rating: res.mpaa_rating || '',
               genre: ( res.genres && res.genres.length ? res.genres[0] : '' ),
               critics_rating: ( res.ratings && res.ratings.critics_rating ? res.ratings.critics_rating : '' ),
               critics_score: ( res.ratings && res.ratings.critics_score ? res.ratings.critics_score : '' ),
               audience_rating: ( res.ratings && res.ratings.audience_rating ? res.ratings.audience_rating : '' ),
               audience_score: ( res.ratings && res.ratings.audience_score ? res.ratings.audience_score : '' ),
               cast: (res.abridged_cast ? _.pluck( res.abridged_cast, 'name' ).join(', ') : ''),
               image: res.posters.thumbnail,
               synopsis: (res.synopsis || '').slice(0, 150),
               link: res.links.alternate
            };

      },

      sync: function(method, model, options){

         options.timeout = 10000;
         options.dataType = 'jsonp';

         return Backbone.sync(method, model, options);
      }

   });


   var MovieCollection = Backbone.Collection.extend({

         model: MovieModel,

         urlRoot: 'http://api.rottentomatoes.com/api/public/v1.0/',
         apikey: 'xc8w3a2sbj7b7mgrv9e75c52', /* please change to use your key */
         listSrc: 'box_office',
         searchTerm: '',

         url: function () {
            if ( this.listSrc == 'search' )
               return _.result(this, 'urlRoot') + 'movies.json?q='+ this.searchTerm +'&page_limit=50&apikey=' + this.apikey;
            else
               return _.result(this, 'urlRoot') + 'lists/movies/' + this.listSrc + '.json?apikey=' + this.apikey;
         },

         sync: function(method, model, options){

            options.timeout = 10000;
            options.dataType = 'jsonp';

            return Backbone.sync(method, model, options);
         },

         parse: function ( res ) {

            return res.movies;
         },

         load: function ( lsrc ) {

            this.listSrc = lsrc || 'box_office';

            return this.fetch();

         },

         search: function ( term ) {

            this.listSrc = 'search';
            this.searchTerm = term;

            return this.fetch();

         }

      }, { model: MovieModel });
