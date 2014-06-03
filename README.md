# diagram-js Bower Package

This is a packaged version of [diagram-js](https://github.com/bpmn-io/diagram-js) for usage via [bower](http://bower.io/).


## Usage

Install the dependency via

```
bower install diagram-js
```

Include the file into your project

```html
<html>

  <body>
    <!-- ... -->

    <script src="bower_components/diagram-js/diagram.min.js"></script>

    <script>
      // require is part of bundle file
      var Diagram = require('diagram-js');

      // instantiate diagram ...
    </script>

  </body>
</html>
```


## License

Use under the terms of the [MIT license](http://opensource.org/licenses/MIT).