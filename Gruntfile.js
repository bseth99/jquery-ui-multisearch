module.exports = function( grunt ) {

grunt.initConfig({

   pkg: grunt.file.readJSON("package.json"),

   concat: {
      dist: {
         src: [ "src/jqueryui-multisearch.js" ],
         dest: "jqueryui-multisearch.js"
      }
   },

   uglify: {
      options: {
         banner: "/*! <%= pkg.name %>: <%= pkg.title %> (v<%= pkg.version %> built <%= grunt.template.today('isoDate') %>)\n" +
                 "<%= pkg.homepage ? '* ' + pkg.homepage + '\\n' : '' %>" +
                 "* Copyright <%= grunt.template.today('yyyy') %> <%= pkg.author.name %>; " +
                 " Licensed <%= _.pluck(pkg.licenses, 'type').join(', ') %> \n*/\n"
      },

      "jqueryui-multisearch.min.js": [ "<banner>", "jqueryui-multisearch.js" ]
   },

   jshint: {
      options: {
         jshintrc: ".jshintrc"
      },
      files: {
        src: [ "src/jqueryui-multisearch.js" ]
      }
   }

});

grunt.loadNpmTasks( "grunt-contrib-jshint" );
grunt.loadNpmTasks( "grunt-contrib-uglify" );
grunt.loadNpmTasks( "grunt-contrib-concat" );

grunt.registerTask( "default", [ "jshint", "concat", "uglify" ] );

};
