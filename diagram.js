require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"4B6uBI":[function(require,module,exports){
var di = require('./di');

// diagram-js main components
require('./core/Canvas');
require('./core/EventBus');


/**
 * @namespace djs
 */

var defaultModule = di.defaultModule;

function createInjector(options) {

  options = options || {};

  var components = [ 'canvas', 'eventBus' ].concat(options.components || []),
      modules = [].concat(options.modules || []);

  if (modules.indexOf(defaultModule) === -1) {
    modules.unshift(defaultModule);
  }

  return di.bootstrap(modules, components, options);
}

/**
 * @class
 *
 * The main diagram-js entry point that bootstraps the diagram with the given
 * configuration.
 *
 * @param {Object} options
 * @param {String[]} options.components a list of components to instantiate when creating the diagram
 * @param {String[]} options.modules a list of modules to use for locating instantiatable diagram components
 */
function Diagram(options, injector) {
  'use strict';

  // create injector unless explicitly specified
  injector = injector || createInjector(options);

  // fire diagram init because
  // all components have been loaded now

  /**
   * An event indicating that all plug-ins are loaded.
   *
   * Use this event to fire other events to interested plug-ins
   *
   * @memberOf Diagram
   *
   * @event diagram.init
   *
   * @example
   *
   * events.on('diagram.init', function() {
   *   events.fire('my-custom-event', { foo: 'BAR' });
   * });
   *
   * @type {Object}
   * @property {snapsvg.Paper} paper the initialized drawing paper
   */
  injector.get('eventBus').fire('diagram.init');

  function destroy() {
    injector.get('eventBus').fire('diagram.destroy');
  }

  // API

  /**
   * Resolves a diagram service
   *
   * @method Diagram#get
   *
   * @param {Function|Object[]} function that should be called with internal diagram services on
   * @param {Object} locals a number of locals to use to resolve certain dependencies
   */
  this.get = injector.get;

  /**
   * Executes a function into which diagram services are injected
   *
   * @method Diagram#invoke
   *
   * @param {Function|Object[]} fn the function to resolve
   * @param {Object} locals a number of locals to use to resolve certain dependencies
   */
  this.invoke = injector.invoke;

  /**
   * Destroys the diagram
   *
   * @method  Diagram#destroy
   */
  this.destroy = destroy;
}

module.exports = Diagram;

/**
 * The main diagram module that can be used
 * to register an extension on the diagram.
 *
 * @field Diagram.components
 * @type {didi.Module}
 */
module.exports.components = defaultModule;

/**
 * Registers an extension with the diagram.
 *
 * @method Diagram.plugin
 * @example
 *
 * var Diagram = require('Diagram');
 *
 * Diagram.plugin('mySamplePlugin', [ 'eventBus', function(events) {
 *   events.on('shape.added', function(event) {
 *     console.log('shape ', event.shape, ' was added to the diagram');
 *   });
 * }]);
 *
 * var diagram = new Diagram({ components: ['mySamplePlugin'] });
 *
 * diagram.invoke([ 'canvas', function(canvas) {
 *
 *   // add shape to drawing canvas
 *   canvas.addShape({ x: 10, y: 10 });
 * });
 *
 * // 'shape ... was added to the diagram' logged to console
 *
 * @param {String} pluginId a unique identifier to reference this plugin from other components
 * @param {Object[]|Function} definition the plugin definition
 *
 * @see Diagram
 */
module.exports.plugin = defaultModule.type;
},{"./core/Canvas":5,"./core/EventBus":8,"./di":10}],"diagram-js":[function(require,module,exports){
module.exports=require('4B6uBI');
},{}],3:[function(require,module,exports){
'use strict';

require('../core/ElementRegistry');

var _ = require('lodash'),
    setParent = require('../util/ShapeUtil').setParent;


/**
 * Implements re- and undoable addition of shapes to the diagram
 *
 * @param {EventBus} events
 * @param {GraphicsFactory} graphicsFactory
 * @param {ElementRegistry} shapes
 */
function AddShapeHandler(events, graphicsFactory, shapes) {

  var paper;

  /**
   * Execute add
   */
  function execute(ctx) {

    var shape = ctx.shape,
        parent = ctx.parent || shape.parent;

    // remember parent outside shape
    ctx.parent = parent;

    // establish shape -> parent -> shape relationship
    setParent(shape, parent);

    var gfx = graphicsFactory.createShape(paper, shape);

    events.fire('shape.added', { element: shape, gfx: gfx });

    return gfx;
  }


  /**
   * Execute revert
   */
  function revert(ctx) {

    var shape = ctx.shape,
        gfx = shapes.getGraphicsByShape(shape);

    setParent(shape, null);

    events.fire('shape.removed', { element: shape, gfx: gfx });

    gfx.remove();
  }


  function canExecute(ctx) {
    return true;
  }


  // load paper from canvas init event
  events.on('canvas.init', function(e) {
    paper = e.paper;
  });


  // API

  this.execute = execute;
  this.revert = revert;

  this.canExecute = canExecute;
}


AddShapeHandler.$inject = ['eventBus', 'graphicsFactory', 'elementRegistry'];

// export
module.exports = AddShapeHandler;
},{"../core/ElementRegistry":7,"../util/ShapeUtil":30,"lodash":36}],4:[function(require,module,exports){
require('../core/ElementRegistry');

var _ = require('lodash'),
    selfAndAllChildren = require('../util/ShapeUtil').selfAndAllChildren,
    setParent = require('../util/ShapeUtil').setParent;


/**
 * Implements re- and undoable movement of shapes and their
 * related graphical representations.
 *
 * @param {ElementRegistry} shapes
 */
function MoveShapesHandler(elementRegistry) {

  function getAllMovedShapes(shapes) {
    var allShapes = selfAndAllChildren(shapes);
    var idMap = {};

    _.forEach(allShapes, function(s) {
      var id = s.id;

      idMap[s.id] = s;
    });

    return {
      shapes: allShapes,
      byId: idMap
    };
  }

  /**
   * Executes a move shape operation
   */
  function execute(ctx) {

    var dx = ctx.dx,
        dy = ctx.dy,
        shapes = ctx.shapes,
        newParent = ctx.newParent;

    var oldParents = {};

    var all = getAllMovedShapes(shapes);

    _.forEach(all.shapes, function(s) {
      var newX = s.x + dx,
          newY = s.y + dy,
          sid = s.id;

      s.x = newX;
      s.y = newY;

      if (s.parent && all.byId[s.parent.id]) {
        oldParents[sid] = s.parent;
      } else {
        oldParents[sid] = setParent(s, newParent);
      }

      var gfx = elementRegistry.getGraphicsByShape(s);
      gfx.translate(newX, newY);

      if (s.parent) {
        var parentGfx = elementRegistry.getGraphicsByShape(s.parent);
        gfx.insertAfter(parentGfx);
      }
    });

    // remember previous parents
    // TODO(nre): is this a good idea?
    ctx.oldParents = oldParents;

    return true;
  }

  /**
   * Reverts a move shape operation
   */
  function revert(ctx) {

    var dx = ctx.dx * -1,
        dy = ctx.dy * -1,
        shapes = ctx.shapes,
        oldParents = ctx.oldParents;


    var all = getAllMovedShapes(shapes);

    _.forEach(all.shapes, function(s) {
      var newX = s.x + dx,
          newY = s.y + dy;

      s.x = newX;
      s.y = newY;

      setParent(s, oldParents[s.id]);

      var gfx = elementRegistry.getGraphicsByShape(s);
      gfx.translate(newX, newY);
    });

    return true;
  }

  /**
   * Can move be executed?
   */
  function canExecute(ctx) {
    return true;
  }


  // API

  this.execute = execute;
  this.revert = revert;

  this.canExecute = canExecute;
}


MoveShapesHandler.$inject = [ 'elementRegistry' ];

// export
module.exports = MoveShapesHandler;
},{"../core/ElementRegistry":7,"../util/ShapeUtil":30,"lodash":36}],5:[function(require,module,exports){
'use strict';

var diagramModule = require('../di').defaultModule;

var AddShapeHandlerHandler = require('../commands/AddShapeHandler');

var _ = require('lodash');


// required components
require('./EventBus');
require('./CommandStack');
require('./GraphicsFactory');
require('./ElementRegistry');

/**
 * @type djs.ShapeDescriptor
 */

/**
 * Creates a HTML container element for a SVG element with
 * the given configuration

 * @param  {Object} options
 * @return {DOMElement} the container element
 */
function createContainer(options) {

  options = _.extend({}, { width: '100%', height: '100%' }, options);

  var container = options.container || document.body;

  // create a <div> around the svg element with the respective size
  // this way we can always get the correct container size
  // (this is impossible for <svg> elements at the moment)
  var parent = document.createElement('div');
  parent.setAttribute('class', 'djs-container');

  parent.style.position = 'relative';
  parent.style.width = _.isNumber(options.width) ? options.width + 'px' : options.width;
  parent.style.height = _.isNumber(options.height) ? options.height + 'px' : options.height;

  container.appendChild(parent);

  return parent;
}


/**
 * @class
 *
 * @emits Canvas#canvas.init
 *
 * @param {Object} config
 * @param {EventBus} events
 * @param {CommandStack} commandStack
 * @param {GraphicsFactory} graphicsFactory
 * @param {ElementRegistry} elementRegistry
 */
function Canvas(config, events, commandStack, graphicsFactory, elementRegistry) {

  var options = _.extend(config.canvas || {});


  // Creates a <svg> element that is wrapped into a <div>.
  // This way we are always able to correctly figure out the size of the svg element
  // by querying the parent node.
  //
  // (It is not possible to get the size of a svg element cross browser @ 2014-04-01)
  //
  // <div class="djs-container" style="width: {desired-width}, height: {desired-height}">
  //   <svg width="100%" height="100%">
  //    ...
  //   </svg>
  // </div>

  var container = createContainer(options);
  var paper = createPaper(container);


  function createPaper(container) {
    return graphicsFactory.createPaper({ container: container, width: '100%', height: '100%' });
  }

  /**
   * Validate the id of an element, ensuring it is present and not yet assigned
   */
  function validateId(element) {

    if (!element.id) {
      throw new Error('element must have an id');
    }

    if (elementRegistry.getShapeById(element.id)) {
      throw new Error('element with id ' + element.id + ' already exists');
    }
  }

  /**
   * Adds a shape to the canvas
   *
   * @method Canvas#addShape
   *
   * @param {djs.ShapeDescriptor} shape a descriptor for the shape
   *
   * @return {Canvas} the canvas api
   */
  function addShape(shape) {

    validateId(shape);

    /**
     * An event indicating that a new shape has been added to the canvas.
     *
     * @memberOf Canvas
     *
     * @event shape.added
     * @type {Object}
     * @property {djs.ElementDescriptor} element the shape descriptor
     * @property {Object} gfx the graphical representation of the shape
     */

    commandStack.execute('shape.add', { shape: shape });

    return this;
  }

  // register shape add handlers
  commandStack.registerHandler('shape.add', AddShapeHandlerHandler);


  /**
   * Adds a connection to the canvas
   *
   * @method Canvas#addConnection
   *
   * @param {djs.ElementDescriptor} connection a descriptor for the connection
   *
   * @return {Canvas} the canvas api
   */
  function addConnection(connection) {

    validateId(connection);

    var gfx = graphicsFactory.createConnection(paper, connection);

    /**
     * An event indicating that a new connection has been added to the canvas.
     *
     * @memberOf Canvas
     *
     * @event connection.added
     * @type {Object}
     * @property {djs.ElementDescriptor} element the connection descriptor
     * @property {Object} gfx the graphical representation of the connection
     */
    events.fire('connection.added', { element: connection, gfx: gfx });

    // for chaining of API calls
    return this;
  }

  /**
   * Sends a shape to the front.
   *
   * This method takes parent / child relationships between shapes into account
   * and makes sure that children are properly handled, too.
   *
   * @method Canvas#sendToFront
   *
   * @param {djs.ElementDescriptor} shape descriptor of the shape to be sent to front
   * @param {boolean} bubble=true whether to send parent shapes to front, too
   */
  function sendToFront(shape, bubble) {

    if (bubble !== false) {
      bubble = true;
    }

    if (bubble && shape.parent) {
      sendToFront(shape.parent);
    }

    if (shape.children) {
      shape.children.forEach(function(child) {
        sendToFront(child, false);
      });
    }

    var gfx = getGraphics(shape),
        gfxParent = gfx.parent();

    gfx.remove().appendTo(gfxParent);
  }

  /**
   * Return the graphical object underlaying a certain diagram element
   *
   * @method Canvas#getGraphics
   *
   * @param {djs.ElementDescriptor} element descriptor of the element
   */
  function getGraphics(element) {
    return elementRegistry.getGraphicsByShape(element);
  }

  /**
   * Returns the underlaying graphics context.
   *
   * @method Canvas#getPaper
   *
   * @returns {snapsvg.Paper} the global paper object
   */
  function getPaper() {
    return paper;
  }

  /**
   * Returns the size of the canvas
   *
   * @return {Object} with x/y coordinates
   */
  function getSize() {

    return {
      width: container.clientWidth,
      height: container.clientHeight
    };
  }

  function parseViewBox(str) {
    if (!str) {
      return;
    }

    var value = str.split(/\s/);

    return {
      x: parseInt(value[0], 10),
      y: parseInt(value[1], 10),
      width: parseInt(value[2], 10),
      height: parseInt(value[3], 10),
    };
  }

  /**
   * Gets or sets the view box of the canvas, i.e. the area that is currently displayed
   *
   * @method Canvas#viewbox
   *
   * @param  {Object} [box] the new view box to set
   * @return {Object} the current view box
   */
  function viewbox(box) {

    var svg = paper.node,
        bbox = svg.getBBox();

    function round(i, accuracy) {
      if (!i) {
        return i;
      }

      accuracy = accuracy || 100;
      return Math.round(i * accuracy) / accuracy;
    }

    var inner = {
      width: round(bbox.width + bbox.x),
      height: round(bbox.height + bbox.y)
    };

    // returns the acutal embedded size of the SVG element
    // would be awesome to be able to use svg.client(Width|Height) or
    // svg.getBoundingClientRect(). Not supported in IE/Firefox though
    var outer = getSize(svg);

    if (box === undefined) {
      box = parseViewBox(svg.getAttribute('viewBox'));

      if (!box) {
        box = { x: 0, y: 0, width: outer.width, height: outer.height };
      }

      // calculate current scale based on svg bbox (inner) and viewbox (outer)
      box.scale = round(Math.min(outer.width / box.width, outer.height / box.height));

      box.inner = inner;
      box.outer = outer;
    } else {
      svg.setAttribute('viewBox', [ box.x, box.y, box.width, box.height ].join(' '));
      events.fire('canvas.viewbox.changed', { viewbox: viewbox() });
    }

    return box;
  }

  /**
   * Gets or sets the scroll of the canvas.
   *
   * @param {Object} [delta] the new scroll to apply.
   *
   * @param {Number} [delta.dx]
   * @param {Number} [delta.dy]
   *
   * @return {Point} the new scroll
   */
  function scroll(delta) {

    var vbox = viewbox();

    if (delta) {
      if (delta.dx) {
        vbox.x += delta.dx;
      }

      if (delta.dy) {
        vbox.y += delta.dy;
      }

      viewbox(vbox);
    }

    return { x: vbox.x, y: vbox.y };
  }

  /**
   * Gets or sets the current zoom of the canvas, optionally zooming to the specified position.
   *
   * @method Canvas#zoom
   *
   * @param {String|Number} [newScale] the new zoom level, either a number, i.e. 0.9,
   *                                   or `fit-viewport` to adjust the size to fit the current viewport
   * @param {String|Point} [center] the reference point { x: .., y: ..} to zoom to, 'auto' to zoom into mid or null
   *
   * @return {Number} the current scale
   */
  function zoom(newScale, center) {

    var vbox = viewbox(),
        inner = vbox.inner,
        outer = vbox.outer;

    if (newScale === undefined) {
      return vbox.scale;
    }

    if (newScale === 'fit-viewport') {
      newScale = Math.min(outer.width / inner.width, outer.height / inner.height, 1.0);

      // reset viewbox so that everything is visible
      _.extend(vbox, { x: 0, y: 0 });
    }

    if (center === 'auto') {
      center = {
        x: outer.width / 2 - 1,
        y: outer.height / 2 - 1
      };
    }

    if (center) {

      // zoom to center (i.e. simulate a maps like behavior)

      // center on old zoom
      var pox = center.x / vbox.scale + vbox.x;
      var poy = center.y / vbox.scale + vbox.y;

      // center on new zoom
      var pnx = center.x / newScale;
      var pny = center.y / newScale;

      // delta = new offset
      var px = pox - pnx;
      var py = poy - pny;

      var position = {
        x: px,
        y: py
      };

      _.extend(vbox, position);
    }

    _.extend(vbox, {
      width: outer.width / newScale,
      height: outer.height / newScale
    });

    viewbox(vbox);

    // return current scale
    return newScale;
  }

  events.on('diagram.init', function(event) {

    /**
     * An event indicating that the canvas is ready to be drawn on.
     *
     * @memberOf Canvas
     *
     * @event canvas.init
     *
     * @type {Object}
     * @property {snapsvg.Paper} paper the initialized drawing paper
     */
    events.fire('canvas.init', { paper: paper });
  });

  events.on('diagram.destroy', function() {

    if (container) {
      var parent = container.parentNode;
      parent.removeChild(container);
    }

    container = null;
    paper = null;
  });

  this.zoom = zoom;
  this.scroll = scroll;

  this.viewbox = viewbox;
  this.addShape = addShape;

  this.addConnection = addConnection;
  this.getPaper = getPaper;

  this.getGraphics = getGraphics;

  this.sendToFront = sendToFront;
}

diagramModule.type('canvas', [ 'config', 'eventBus', 'commandStack', 'graphicsFactory', 'elementRegistry', Canvas ]);

module.exports = Canvas;
},{"../commands/AddShapeHandler":3,"../di":10,"./CommandStack":6,"./ElementRegistry":7,"./EventBus":8,"./GraphicsFactory":9,"lodash":36}],6:[function(require,module,exports){
'use strict';

var diagramModule = require('../di').defaultModule;

var _ = require('lodash');


require('./EventBus');

/**
 * @namespace djs
 */

/**
 * @class
 *
 * This service offer an action history for the application.
 * So that the diagram can support undo/redo. All actions applied
 * to the diagram must be invoked through this Service.
 *
 * @param {Injector} injector
 * @param {EventBus} events
 */
function CommandStack(injector, events) {

  /**
   *
   * @type {Object} Key is the command id and value is a list of registered handler methods}
   */
  var handlerMap = {};

  /**
   * The stack containing all re/undoable actions on the diagram
   * @type {Array<Object>}
   */
  var stack = [];

  /**
   * The current index on the stack
   * @type {Number}
   */
  var stackIdx = -1;


  function redoAction() {
    return stack[stackIdx + 1];
  }

  function undoAction() {
    return stack[stackIdx];
  }

  /**
   * Execute all registered actions for this command id
   *
   * @param {String} id of the action
   * @param {Object} ctx is a parameter object for the executed action
   */
  function execute(id, ctx) {
    var action = { id: id, ctx: ctx };

    internalExecute(action);
  }

  /**
   * Execute all registered actions for this command id
   *
   * @param {String} id of the action
   * @param {Object} ctx is a parameter object for the executed action
   * @param {Boolean} saveRedoStack if true the redo stack is not reset.
   *                  This must be set when an redo action is applied.
   */
  function internalExecute(action) {
    var id = action.id,
        ctx = action.ctx;

    if (!action.id) {
      throw new Error('action has no id');
    }

    events.fire('commandStack.execute', { id: id });

    var handlers = getHandlers(id);

    if (!(handlers && handlers.length)) {
      console.warn('no command handler registered for ', id);
    }

    var executedHandlers = [];

    _.forEach(handlers, function(handler) {
      if (handler.execute(ctx)) {
        executedHandlers.push(handler);
      } else {
        // TODO(nre): handle revert case, i.e. the situation that one of a number of handlers fail
      }
    });

    executeFinished(action);
  }

  function executeFinished(action) {
    if (redoAction() !== action) {
      stack.splice(stackIdx + 1, stack.length, action);
    }

    stackIdx++;

    events.fire('commandStack.changed');
  }


  function undo() {

    var action = undoAction();
    if (!action) {
      return false;
    }

    events.fire('commandStack.revert', { id: action.id });

    var handlers = getHandlers(action.id);
    _.forEach(handlers, function(handler) {
      handler.revert(action.ctx);
    });

    revertFinished(action);
  }

  function revertFinished(action) {
    stackIdx--;

    events.fire('commandStack.changed');
  }

  function redo() {

    var action = redoAction();
    if (action) {
      internalExecute(action);
    }

    return action;
  }

  function getHandlers(id) {
    if (id) {
      return handlerMap[id];
    } else {
      return handlerMap;
    }
  }

  function addHandler(id, handler) {
    assertValidId(id);

    var handlers = handlerMap[id];
    if (!handlers) {
      handlerMap[id] = handlers = [];
    }

    handlers.push(handler);
  }

  function getStack() {
    return stack;
  }

  function getStackIndex() {
    return stackIdx;
  }

  function clear() {
    stack.length = 0;
    stackIdx = -1;
  }


  ////// registration ////////////////////////////////////////

  function assertValidId(id) {
    if (!id) {
      throw new Error('no id specified');
    }
  }

  function register(id, handler) {
    addHandler(id, handler);
  }

  function registerHandler(command, handlerCls) {

    if (!command || !handlerCls) {
      throw new Error('command and handlerCls must be defined');
    }

    var handler = injector.instantiate(handlerCls);
    register(command, handler);
  }

  return {
    execute: execute,
    undo: undo,
    redo: redo,
    clear: clear,
    getStack: getStack,
    getStackIndex: getStackIndex,
    getHandlers: getHandlers,
    registerHandler: registerHandler,
    register: register
  };
}

diagramModule.type('commandStack', [ 'injector', 'eventBus', CommandStack ]);

module.exports = CommandStack;
},{"../di":10,"./EventBus":8,"lodash":36}],7:[function(require,module,exports){
var diagramModule = require('../di').defaultModule;

var _ = require('lodash');

// required components
require('./EventBus');

/**
 * @class
 *
 * A registry that keeps track of all shapes in the diagram.
 *
 * @param {EventBus} events the event bus
 */
function ElementRegistry(events) {

  // mapping shape.id -> container
  var shapeMap = {};

  // mapping gfx.id -> container
  var graphicsMap = {};

  function addShape(shape, gfx) {
    if (!shape.id) {
      throw new Error('[shapes] shape has no id');
    }

    if (!gfx.id) {
      throw new Error('[shapes] graphics has no id');
    }

    if (graphicsMap[gfx.id]) {
      throw new Error('graphics with id ' + gfx.id + ' already registered');
    }

    if (shapeMap[shape.id]) {
      throw new Error('shape with id ' + shape.id + ' already added');
    }

    shapeMap[shape.id] = graphicsMap[gfx.id] = { shape: shape, gfx: gfx };
  }

  function removeShape(shape) {
    var gfx = getGraphicsByShape(shape);

    if(shape.parent) {
      for(var i = 0; i < shape.parent.children.length;i++) {
        if(shape.parent.children[i].id === shape.id) {
          shape.parent.children.splice(i, 1);
        }
      }
    }
   // delete shape.parent.children[];
    delete shapeMap[shape.id];
    delete graphicsMap[gfx.id];
  }

  /**
   * @method ElementRegistry#getShapeByGraphics
   */
  function getShapeByGraphics(gfx) {
    var id = _.isString(gfx) ? gfx : gfx.id;

    var container = graphicsMap[id];
    if (container) {
      return container.shape;
    }
  }

  /**
   * @method ElementRegistry#getShapeById
   */
  function getShapeById(id) {
    var container = shapeMap[id];
    if (container) {
      return container.shape;
    }
  }

  /**
   * @method ElementRegistry#getGraphicsByShape
   */
  function getGraphicsByShape(shape) {
    var id = _.isString(shape) ? shape : shape.id;

    var container = shapeMap[id];
    if (container) {
      return container.gfx;
    }
  }

  events.on('shape.added', function(event) {
    addShape(event.element, event.gfx);
  });

  events.on('connection.added', function(event) {
    addShape(event.element, event.gfx);
  });

  events.on('shape.removed', function(event) {
    removeShape(event.element);
  });

  events.on('connection.removed', function(event) {
    removeShape(event.element);
  });

  return {
    getGraphicsByShape: getGraphicsByShape,
    getShapeById: getShapeById,
    getShapeByGraphics: getShapeByGraphics
  };
}

diagramModule.type('elementRegistry', [ 'eventBus', ElementRegistry ]);

module.exports = ElementRegistry;
},{"../di":10,"./EventBus":8,"lodash":36}],8:[function(require,module,exports){
var diagramModule = require('../di').defaultModule;

var _ = require('lodash');

/**
 * @global
 * @type {Object}
 * @static
 */
var EventPriority = {
  standard: 1000,
  overwrite: 10000
};

/**
 * @class
 *
 * A general purpose event bus
 */
function EventBus() {
  'use strict';

  var listenerMap = {};

  function getListeners(name) {
    var listeners = listenerMap[name];

    if (!listeners) {
      listeners = listenerMap[name] = [];
    }

    return listeners;
  }

  function extendEvent(event, type) {

    var propagationStopped,
        defaultPrevented;

    _.extend(event, {
      type: type,

      stopPropagation: function() {
        this.propagationStopped = true;
      },
      preventDefault: function() {
        this.defaultPrevented = true;
      },

      isPropagationStopped: function() {
        return !!this.propagationStopped;
      },

      isDefaultPrevented: function() {
        return !!this.defaultPrevented;
      }
    });

    return event;
  }

  /**
   * Register an event listener for events with the given name.
   *
   * The callback will be invoked with `event, ...additionalArguments`
   * that have been passed to the evented element.
   *
   * @method Events#on
   *
   * @param {String} event
   * @param {Function} callback
   * @param {Number} Set priority to influence the execution order of the callbacks.
   * The default priority is 1000. It should only set to higher values (> {@link EventPriority#overwrite}) if
   * there is real need for a changed execution priority.
   */
  function on(event, callback, priority) {
    if(priority && !_.isNumber(priority)) {
      console.error('Priority needs to be a number');
      priority = EventPriority.standard;
    }
    if(!priority) {
      priority = EventPriority.standard;
    }
    var listeners = getListeners(event);
    addEventToArray(listeners, callback, priority);
  }

  /**
   * Register an event listener that is executed only once.
   *
   * @method Events#once
   *
   * @param {String} event the event name to register for
   * @param {Function} callback the callback to execute
   *
   * @see Events#on
   */
  function once(event, callback) {

    var self = this;
    var wrappedCallback = function() {
      var eventType = arguments[0].type;
      callback.apply(this, arguments);
      self.off(eventType, wrappedCallback);
    };

    this.on(event, wrappedCallback);
  }

  /**
   * Removes event listeners by event and callback.
   *
   * If no callback is given, all listeners for a given event name are being removed.
   *
   * @method Events#off
   *
   * @param {String} event
   * @param {Function} [callback]
   */
  function off(event, callback) {
    var listeners, idx;

    listeners = getListeners(event);
    if (callback) {
      _.forEach(listeners, function(listener) {
        if(listener.callback === callback) {
          idx = listeners.indexOf(listener);
        }
      });

      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    } else {
      listeners.length = 0;
    }
  }

  /**
   * Fires a named event.
   *
   * @method Events#fire
   *
   * @example
   *
   * // fire event by name
   * events.fire('foo');
   *
   * // fire event object with nested type
   * var event = { type: 'foo' };
   * events.fire(event);
   *
   * // fire event with explicit type
   * var event = { x: 10, y: 20 };
   * events.fire('element.moved', event);
   *
   * // pass additional arguments to the event
   * events.on('foo', function(event, bar) {
   *   alert(bar);
   * });
   *
   * events.fire({ type: 'foo' }, 'I am bar!');
   *
   * @param {String} [name] the optional event name
   * @param {Object} [event] the event object
   * @param {...Object} additional arguments to be passed to the callback functions
   */
  function fire() {
    var event, eventType,
        listeners, i, l,
        args;

    args = Array.prototype.slice.call(arguments);

    eventType = args[0];

    if (_.isObject(eventType)) {
      event = eventType;

      // parse type from event
      eventType = event.type;
    } else {
      // remove name parameter
      args.shift();

      event = args[0] || {};
      event.type = eventType;
      if(args.length === 0) {
        args.push(event);
      }
    }

    listeners = getListeners(eventType);
    event = extendEvent(event, eventType);

    for (i = 0, l; !!(l = listeners[i]); i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      l.callback.apply(this, args);
    }
  }

  function addEventToArray(array, callback, priority) {

    array.push({
      priority: priority,
      callback: callback
    });

    array.sort(function(a, b) {
      if(a.priority < b.priority) {
        return 1;
      } else if (a.priority > b.priority) {
        return -1;
      } else {
        return 0;
      }
    });
  }

  this.on = on;
  this.once = once;
  this.off = off;
  this.fire = fire;
}

diagramModule.type('eventBus', EventBus);

module.exports = EventBus;
},{"../di":10,"lodash":36}],9:[function(require,module,exports){
var diagramModule = require('../di').defaultModule;

// required components
require('./EventBus');

require('../draw/Snap');
require('../draw/Renderer');

/**
 * A factory that creates graphical elements
 *
 * @param {EventBus} events
 * @param {Renderer} renderer
 * @param {Snap} snap
 */
function GraphicsFactory(events, renderer, snap) {

  function createParent(paper, type) {

    return paper
      .group()
        .addClass('djs-group')
        .addClass('djs-' + type);
  }

  function createShape(paper, data) {

    var parent = createParent(paper, 'shape');

    var gfx = renderer.drawShape(parent, data);
    gfx.addClass('djs-visual');

    setPosition(parent, data.x, data.y);

    if (data.hidden) {
      parent.attr('visibility', 'hidden');
    }

    return parent;
  }

  function createConnection(paper, data) {
    var parent = createParent(paper, 'connection');

    var gfx = renderer.drawConnection(parent, data);
    gfx.addClass('djs-visual');

    return parent;
  }

  function setPosition(gfx, x, y) {
    var positionMatrix = new snap.Matrix();
    positionMatrix.translate(x, y);
    gfx.transform(positionMatrix);
  }

  function createPaper(options) {
    return snap.createSnapAt(options.width, options.height, options.container);
  }

  // API
  this.createConnection = createConnection;
  this.createShape = createShape;
  this.createPaper = createPaper;
}

diagramModule.type('graphicsFactory', [ 'eventBus', 'renderer', 'snap', GraphicsFactory ]);

module.exports = GraphicsFactory;
},{"../di":10,"../draw/Renderer":11,"../draw/Snap":12,"./EventBus":8}],10:[function(require,module,exports){
var di = require('didi');

var Module = di.Module,
    Injector = di.Injector;

/**
 * Bootstrap an injector from a list of modules, instantiating a number of default components
 *
 * @param {Array<didi.Module>} modules
 * @param {Array<String>} components
 * @param {Object} config
 *
 * @return {didi.Injector} a injector to use to access the components
 */
function bootstrap(modules, components, config) {

  var configModule = {
    'config': ['value', config]
  };

  modules.unshift(configModule);

  var injector = new Injector(modules);

  components.forEach(function(c) {

    // eagerly resolve main components
    injector.get(c);
  });

  return injector;
}

// publish the default module for diagram-js
module.exports = {
  defaultModule: new Module(),
  bootstrap: bootstrap
};
},{"didi":33}],11:[function(require,module,exports){
'use strict';

var diagramModule = require('../di').defaultModule;

// required components
require('../core/EventBus');
require('./Styles');


function flattenPoints(points) {
  var result = [];

  for (var i = 0, p; !!(p = points[i]); i++) {
    result.push(p.x);
    result.push(p.y);
  }

  return result;
}


/**
 * @class Renderer
 *
 * The default renderer used for shapes and connections.
 *
 * @param {EventBus} events
 * @param {Styles} styles
 */
function Renderer(events, styles) {
  this.CONNECTION_STYLE = styles.style([ 'no-fill' ]);
  this.SHAPE_STYLE = styles.style({ fill: 'fuchsia' });
}

Renderer.prototype.drawShape = function drawShape(paper, data) {
  if (!data.width || !data.height) {
    throw new Error('must specify width and height properties for new shape');
  }

  return paper.rect(0, 0, data.width, data.height, 10, 10).attr(this.SHAPE_STYLE);
};

Renderer.prototype.drawConnection = function drawConnection(paper, data) {
  var points = flattenPoints(data.waypoints);
  return paper.polyline(points).attr(this.CONNECTION_STYLE);
};


diagramModule.type('renderer', [ 'eventBus', 'styles', Renderer ]);


module.exports = Renderer;
module.exports.flattenPoints = flattenPoints;
},{"../core/EventBus":8,"../di":10,"./Styles":13}],12:[function(require,module,exports){
var diagramModule = require('../di').defaultModule;

var snapsvg = require('snapsvg');

// require snapsvg extensions
require('./snapsvg-extensions');

// register as a value
diagramModule.value('snap', snapsvg);

module.exports = snapsvg;
},{"../di":10,"./snapsvg-extensions":14,"snapsvg":37}],13:[function(require,module,exports){
var diagramModule = require('../di').defaultModule;

var _ = require('lodash');

/**
 * A component that manages shape styles
 */
function Styles() {

  var defaultTraits = {

    'no-fill': {
      fill: 'none'
    },
    'no-border': {
      strokeOpacity: 0.0
    },
    'no-events': {
      pointerEvents: 'none'
    }
  };

  /**
   * Builds a style definition from a className, a list of traits and an object of additional attributes.
   *
   * @param  {String} className
   * @param  {Array<String>} traits
   * @param  {Object} additionalAttrs
   *
   * @return {Object} the style defintion
   */
  this.cls = function(className, traits, additionalAttrs) {
    var attrs = this.style(traits, additionalAttrs);

    return _.extend(attrs, { 'class': className });
  };

  /**
   * Builds a style definition from a list of traits and an object of additional attributes.
   *
   * @param  {Array<String>} traits
   * @param  {Object} additionalAttrs
   *
   * @return {Object} the style defintion
   */
  this.style = function(traits, additionalAttrs) {

    if (!_.isArray(traits) && !additionalAttrs) {
      additionalAttrs = traits;
      traits = [];
    }

    var attrs = _.inject(traits, function(attrs, t) {
      return _.extend(attrs, defaultTraits[t] || {});
    }, {});

    return additionalAttrs ? _.extend(attrs, additionalAttrs) : attrs;
  };
}

diagramModule.type('styles', Styles);

module.exports = Styles;
},{"../di":10,"lodash":36}],14:[function(require,module,exports){
var Snap = require('snapsvg');

/**
 * @module snapsvg/extensions
 */

/**
 * @namespace snapsvg
 */

/**
 * @class snapsvg.Element
 */

/**
 * @class ClassPlugin
 *
 * Extends snapsvg with methods to add and remove classes
 */
Snap.plugin(function (Snap, Element, Paper, global) {

  function split(str) {
    return str.split(/\s+/);
  }

  function join(array) {
    return array.join(' ');
  }

  function getClasses(e) {
    return split(e.attr('class') || '');
  }

  function setClasses(e, classes) {
    e.attr('class', join(classes));
  }

  /**
   * @method snapsvg.Element#addClass
   *
   * @example
   *
   * e.attr('class', 'selector');
   *
   * e.addClass('foo bar'); // adds classes foo and bar
   * e.attr('class'); // -> 'selector foo bar'
   *
   * e.addClass('fooBar');
   * e.attr('class'); // -> 'selector foo bar fooBar'
   *
   * @param {String} cls classes to be added to the element
   *
   * @return {snapsvg.Element} the element (this)
   */
  Element.prototype.addClass = function(cls) {
    var current = getClasses(this),
        add = split(cls),
        i, e;

    for (i = 0, e; !!(e = add[i]); i++) {
      if (current.indexOf(e) === -1) {
        current.push(e);
      }
    }

    setClasses(this, current);

    return this;
  };

  /**
   * @method snapsvg.Element#hasClass
   *
   * @param  {String}  cls the class to query for
   * @return {Boolean} returns true if the element has the given class
   */
  Element.prototype.hasClass = function(cls) {
    if (!cls) {
      throw new Error('[snapsvg] syntax: hasClass(clsStr)');
    }

    return getClasses(this).indexOf(cls) !== -1;
  };

  /**
   * @method snapsvg.Element#removeClass
   *
   * @example
   *
   * e.attr('class', 'foo bar');
   *
   * e.removeClass('foo');
   * e.attr('class'); // -> 'bar'
   *
   * e.removeClass('foo bar'); // removes classes foo and bar
   * e.attr('class'); // -> ''
   *
   * @param {String} cls classes to be removed from element
   *
   * @return {snapsvg.Element} the element (this)
   */
  Element.prototype.removeClass = function(cls) {
    var current = getClasses(this),
        remove = split(cls),
        i, e, idx;

    for (i = 0, e; !!(e = remove[i]); i++) {
      idx = current.indexOf(e);

      if (idx !== -1) {
        // remove element from array
        current.splice(idx, 1);
      }
    }

    setClasses(this, current);

    return this;
  };

});

/**
 * @class TranslatePlugin
 *
 * Extends snapsvg with methods to translate elements
 */
Snap.plugin(function (Snap, Element, Paper, global) {

  /*
   * @method snapsvg.Element#translate
   *
   * @example
   *
   * e.translate(10, 20);
   *
   * // sets transform matrix to translate(10, 20)
   *
   * @param {Number} x translation
   * @param {Number} y translation
   *
   * @return {snapsvg.Element} the element (this)
   */
  Element.prototype.translate = function(x, y) {
    var matrix = new Snap.Matrix();
    matrix.translate(x, y);
    this.transform(matrix);
  };
});

/**
 * @class CreatSnapAtPlugin
 *
 * Extends snap.svg with a method to create a SVG element
 * at a specific position in the DOM.
 */
Snap.plugin(function (Snap, Element, Paper, global) {

  /*
   * @method snapsvg.createSnapAt
   *
   * @example
   *
   * snapsvg.createSnapAt(parentNode, 200, 200);
   *
   * @param {Number} width of svg
   * @param {Number} height of svg
   * @param {Object} parentNode svg Element will be child of this
   *
   * @return {snapsvg.Element} the newly created wrapped SVG element instance
   */
  Snap.createSnapAt = function(width, height, parentNode) {

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    if (!parentNode) {
      parentNode = document.body;
    }
    parentNode.appendChild(svg);

    return new Snap(svg);
  };
});
},{"snapsvg":37}],15:[function(require,module,exports){
require('../core/EventBus');
require('../core/ElementRegistry');

require('./InteractionEvents');

var Diagram = require('../Diagram'),
    _ = require('lodash');


/**
 * Provides bendpoint visualization, hover and interactivity.
 * 
 * @class
 *
 * @param {EventBus} events the event bus
 * @param {ElementRegistry} shapes the shape registry
 * @param {CommandStack} commandStack the command stack
 */
function Bendpoints(events, shapes, canvas, commandStack) {

  var DRAG_START_THRESHOLD = 10;

  function dragStartThresholdReached(dx, dy) {
    return Math.abs(dx) > DRAG_START_THRESHOLD ||
           Math.abs(dy) > DRAG_START_THRESHOLD;
  }

  var paper;

  function makeDraggable(connection, gfx, bendpointGfx) {

    var dragCtx;

    function connectOver(event) {
      var dragEvt = _.extend({}, event, { dragCtx: dragCtx });

      events.fire('shape.connectover', dragEvt);

      dragCtx.hover = event.gfx;
    }

    function connectOut(event) {
      var dragEvt = _.extend({}, event, { dragCtx: dragCtx });

      events.fire('shape.connectout', dragEvt);

      delete dragCtx.hover;
    }

    bendpointGfx.drag(function dragging(dx, dy, x, y, e) {

      var graphics = dragCtx.graphics,
          dragGroup = dragCtx.dragGroup;

      // drag start
      if (!dragCtx.dragging && dragStartThresholdReached(dx, dy)) {

        events.on('shape.hover', connectOver);
        events.on('shape.out', connectOut);

        dragCtx.dragging = true;

        dragCtx.dragGroup = dragGroup = paper.group(graphics.clone()).attr('pointer-events', 'none');

        /**
         * An event indicating that a drag operation has started
         *
         * @memberOf Drag
         * 
         * @event shape.dragstart
         * @type {Object}
         * 
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical representation of the shape
         * @property {Object} dragCtx the drag context
         */
        events.fire('bendpoint.dragstart', { element: connection, gfx: gfx, dragCtx: dragCtx });
      }

      // drag move
      if (dragCtx.dragging) {

        _.extend(dragCtx, {
          dx: dx, dy: dy
        });

        dragGroup.translate(dx, dy);

        /**
         * An event indicating that a move happens during a drag operation
         *
         * @memberOf Drag
         * 
         * @event shape.dragmove
         * @type {Object}
         * 
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical representation of the shape
         * @property {Object} dragCtx the drag context
         */
        events.fire('bendpoint.dragmove', { element: connection, gfx: gfx, dragCtx: dragCtx });
      }
    }, function dragStart(x, y, e) {

        // prepare a drag ctx that gets later activated when
        // a given drag threshold is reached
        dragCtx = {
          graphics: bendpointGfx,
          connectionGfx: gfx,
          connection: connection
        };
    }, function dragEnd(x, y, e) {

      events.off('shape.hover', connectOver);
      events.off('shape.out', connectOut);

      if (dragCtx.dragging) {

        var event = { element: connection, gfx: gfx, dragCtx: dragCtx };

        dragCtx.dragGroup.remove();

        /**
         * An event indicating that a drag operation has ended
         *
         * @memberOf Drag
         * 
         * @event shape.dragstart
         * @type {Object}
         * 
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical representation of the shape
         * @property {Object} dragCtx the drag context
         */
        events.fire('bendpoint.dragend', event);

        if (!event.isDefaultPrevented()) {
          commandStack.execute('movebendpoint', { event: event });
        }
      }

      dragCtx = null;
    });
  }

  function addBendpoints(element, gfx) {

    element.waypoints.forEach(function(p) {

      var bendpointGfx = paper.circle(p.x, p.y, 10).addClass('djs-bendpoint').appendTo(gfx);

      makeDraggable(element, gfx, bendpointGfx);
    });
  }

  events.on('connection.added', function(event) {
    addBendpoints(event.element, event.gfx);
  });


  // load paper from initialized canvas
  
  events.on('canvas.init', function(event) {
    paper = event.paper;
  });

  events.on('diagram.destroy', function() {
    paper = null;
  });
}

Diagram.plugin('bendpoints', [
  'eventBus',
  'elementRegistry',
  'canvas',
  'commandStack',
  'interactionEvents', Bendpoints ]);

module.exports = Bendpoints;
},{"../Diagram":"4B6uBI","../core/ElementRegistry":7,"../core/EventBus":8,"./InteractionEvents":17,"lodash":36}],16:[function(require,module,exports){
var _ = require('lodash'),
    EventEmitter = require('../util/EventEmitter');

var DEFAULT_THRESHOLD = 10;

/**
 * A draggable implementation that fires drag related events
 * whenever the given gfx changes.
 */
function Draggable(gfx, options) {

  options = _.extend({
    threshold: DEFAULT_THRESHOLD,
    payload: {},
  }, options || {});


  function isThresholdReached(delta) {
    return Math.abs(delta.x) > options.threshold ||
           Math.abs(delta.y) > options.threshold;
  }

  var self = this;

  var externalEvents;

  var dragContext;

  function emit(name, event, raw) {

    var locals = _.extend({ dragContext: dragContext }, raw ? {} : options.payload || {});
    var dragEvent = _.extend({}, event, locals);

    self.emit(name, dragEvent);

    return dragEvent;
  }

  function dragOver(event) {
    var dragEvent = emit('dragover', event, true);

    if (!dragEvent.isDefaultPrevented()) {
      dragContext.hoverGfx = dragEvent.gfx;
    }
  }

  function dragOut(event) {
    if (dragContext.hoverGfx === event.gfx) {
      emit('dragout', event, true);
    }

    delete dragContext.hoverGfx;
  }

  function dragStart(x, y, event) {

    dragContext = _.extend({
      start: { x: x, y: y }
    }, options.payload);
  }

  function dragMove(dx, dy, x, y, event) {

    if (!dragContext) {
      return;
    }

    var graphics = dragContext.gfx;

    // update delta(x, y)
    _.extend(dragContext, {
      delta: { x: dx, y: dy }
    });

    // drag start
    if (!dragContext.dragging && isThresholdReached(dragContext.delta)) {

      if (externalEvents) {
        externalEvents.on('shape.hover', dragOver);
        externalEvents.on('shape.out', dragOut);
      }

      dragContext.dragging = true;

      emit('dragstart', event);
    }

    // drag move
    if (dragContext.dragging) {

      _.extend(dragContext, {
        delta: { x: dx, y: dy }
      });

      emit('drag', event);
    }
  }

  function dragEnd(x, y, event) {

    if (externalEvents) {
      externalEvents.off('shape.hover', dragOver);
      externalEvents.off('shape.out', dragOut);
    }

    if (dragContext && dragContext.dragging) {
      emit('dragend', event);
    }

    dragContext = null;
  }

  gfx.drag(dragMove, dragStart, dragEnd);

  /**
   * Detect drag over based on the given event stream
   * @param  {EventEmitter} events
   */
  this.withDragOver = function(events) {
    externalEvents = events;
    return this;
  };

  /**
   * Cancel the drag operation, if it is in progress.
   */
  this.cancelDrag = function() {

    if (dragContext && dragContext.dragging) {
      emit('dragcanceled', {});
    }

    dragContext = null;
  };

}

Draggable.prototype = EventEmitter.prototype;

module.exports = Draggable;
},{"../util/EventEmitter":27,"lodash":36}],17:[function(require,module,exports){
require('../core/EventBus');

require('../draw/Styles');

var Diagram = require('../Diagram'),
    _ = require('lodash'),
    getVisual = require('../util/SvgUtil').getVisual;

/**
 * @class
 *
 * A plugin that provides interactivity in terms of events (mouse over and selection to a diagram).
 *
 * @param {EventBus} events the event bus to attach to
 * @param {Styles} styles to build the interaction shape on
 */
function InteractionEvents(events, styles) {

  var HIT_STYLE = styles.cls('djs-hit', [ 'no-fill', 'no-border' ]);

  function isCtxSwitch(e) {
    return !e.relatedTarget || e.target.parentNode !== e.relatedTarget.parentNode;
  }

  function fire(event, baseEvent, eventName) {
    var e = _.extend({}, baseEvent, event);
    events.fire(eventName, e);
  }

  function makeSelectable(element, gfx, options) {
    var dblclick = options.dblclick,
        type = options.type;

    var baseEvent = { element: element, gfx: gfx };

    var visual = getVisual(gfx);

    var hit;

    if (type === 'shape') {
      var bbox = visual.getBBox();
      hit = gfx.rect(bbox.x, bbox.y, bbox.width, bbox.height);
    } else {
      hit = visual.clone();
    }

    hit.attr(HIT_STYLE).prependTo(gfx);

    gfx.hover(function(e) {
      if (isCtxSwitch(e)) {
        fire(e, baseEvent, type + '.hover');
      }
    }, function(e) {
      if (isCtxSwitch(e)) {
        fire(e, baseEvent, type + '.out');
      }
    });

    gfx.click(function(e) {
      fire(e, baseEvent, type + '.click');
    });

    gfx.dblclick(function(e) {
      fire(e, baseEvent, type + '.dblclick');
    });
  }

  function makeConnectionSelectable(connection, gfx) {
    makeSelectable(connection, gfx, { type: 'connection' });
  }

  function makeShapeSelectable(shape, gfx) {
    makeSelectable(shape, gfx, { type: 'shape' });
  }

  function registerEvents(events) {
    events.on('shape.added', function(event) {
      makeShapeSelectable(event.element, event.gfx);
    });

    events.on('connection.added', function(event) {
      makeConnectionSelectable(event.element, event.gfx);
    });
  }

  registerEvents(events);
}

Diagram.plugin('interactionEvents', [ 'eventBus', 'styles', InteractionEvents ]);

module.exports = InteractionEvents;
},{"../Diagram":"4B6uBI","../core/EventBus":8,"../draw/Styles":13,"../util/SvgUtil":31,"lodash":36}],18:[function(require,module,exports){
require('../core/EventBus');

require('../draw/Styles');

var Diagram = require('../Diagram'),
    SvgUtil = require('../util/SvgUtil');

var getVisual = SvgUtil.getVisual;

/**
 * @class
 *
 * A plugin that adds an outline to shapes and connections that may be activated and styled
 * via CSS classes.
 *
 * @param {EventBus} events the event bus
 */
function Outline(events, styles) {

  var OUTLINE_OFFSET = 10;

  var OUTLINE_STYLE = styles.cls('djs-outline', [ 'no-fill' ]);

  function createOutline(gfx) {
    return gfx.rect(0, 0, 0, 0)
            .attr(OUTLINE_STYLE)
            .prependTo(gfx);
  }

  function updateOutline(outline, bbox) {

    outline.attr({
      x: bbox.x - OUTLINE_OFFSET,
      y: bbox.y - OUTLINE_OFFSET,
      width: bbox.width + OUTLINE_OFFSET * 2,
      height: bbox.height + OUTLINE_OFFSET * 2
    });
  }

  events.on('shape.added', function(event) {
    var element = event.element,
        gfx = event.gfx;

    var outline = createOutline(gfx);

    updateOutline(outline, getVisual(gfx).getBBox());
  });

  events.on('connection.change', function(event) {
    // TODO: update connection outline box
  });

  events.on('shape.change', function(event) {
    // TODO: update shape outline box
  });
}

Diagram.plugin('outline', [ 'eventBus', 'styles', Outline ]);

module.exports = Outline;
},{"../Diagram":"4B6uBI","../core/EventBus":8,"../draw/Styles":13,"../util/SvgUtil":31}],19:[function(require,module,exports){
var Diagram = require('../Diagram'),
          _ = require('lodash');

/**
 * @namespace djs
 */

/**
 * @class
 */
function StandardPalette(config, events, canvas, paletteDragDrop, injector) {
  'use strict';

  events.on('canvas.init', function(event) {
    init();
  });

  function init() {
    var menuConfig = config.menu || {};

    bootstrapMenus(menuConfig);

    events.fire('standard.palette.init');

    // intercept direct canvas clicks to deselect all
    // selected shapes

  }

  function bootstrapMenus(menus) {
    if(!menus) {
      console.warn('Menu was undefined');
      return;
    }
    menus.forEach(function(menu) {
      var menuContainer = createMenuContainer(menu);
      //then call menu for init
      //Add to page
      menu.parentContainer.appendChild(menuContainer);
    });
  }

  function createMenuContainer(menu) {
    var menuDiv = document.createElement('div');
    menuDiv.setAttributeNS('http://www.w3.org/1999/xhtml', 'id', 'menu-' + menu.id);

    if(menu.align === 'vertical') {
      menuDiv.setAttribute('class', 'djs-menu-vertical');
    } else if(menu.align === 'vertical') {
      menuDiv.setAttribute('class', 'djs-menu-horizontal');
    } else {
      console.warn('Align %s is invalid', menu.align);
    }

    _.forEach(menu.items, function(item) {

      var icon = document.createElement('i');
      var button = document.createElement('button');
      button.setAttribute('class', 'djs-addshape ' + item.cssClass);
      button.appendChild(icon);

      if(item.text) {
        var textNode = document.createTextNode(item.text);
        button.appendChild(textNode);
      }
      button.addEventListener(item.action.type, function(event) {
        injector.invoke(item.action.handler, { event: event });
      });

      menuDiv.appendChild(button);
    });
    var brand = document.createElement('div');
    brand.setAttribute('class', 'djs-menu-brand');
    menuDiv.appendChild(brand);
    return menuDiv;
  }
}

Diagram.plugin('standardPalette', [ 'config', 'eventBus', 'canvas', 'paletteDragDrop', 'injector',  StandardPalette ]);

module.exports = StandardPalette;
},{"../Diagram":"4B6uBI","lodash":36}],20:[function(require,module,exports){
var _ = require('lodash');

require('../../core/EventBus');
require('../../core/CommandStack');
require('../../core/ElementRegistry');

require('../selection/Service');

require('../InteractionEvents');


var MoveShapesHandler = require('../../commands/MoveShapesHandler'),
    Draggable = require('../Draggable'),
    Diagram = require('../../Diagram');


/**
 * @class
 *
 * A plugin that makes shapes draggable / droppable.
 *
 * @param {EventBus} events the event bus
 * @param {Selection} selection the selection service
 * @param {ElementRegistry} shapes the shapes service
 * @param {CommandStack} commandStack the command stack to perform the actual move action
 */
function MoveEvents(events, selection, shapes, commandStack) {

  ///// execution of actual move ///////////////////////////

  function executeMove(ctx) {

    var delta = ctx.delta;

    var moveContext = {
      dx: delta.x,
      dy: delta.y,
      shapes: ctx.shapes
    };

    var hoverGfx = ctx.hoverGfx;

    if (hoverGfx) {
      moveContext.newParent = shapes.getShapeByGraphics(hoverGfx);
    }

    commandStack.execute('shape.move', moveContext);
  }

  // commandStack default move handler registration
  commandStack.registerHandler('shape.move', MoveShapesHandler);


  ///// draggable implementation ////////////////////////////


  function makeDraggable(element, gfx) {

    var draggable = new Draggable(gfx, {
      payload: { gfx: gfx, element: element }
    }).withDragOver(events);

    draggable
      .on('dragstart', function(event) {

        var dragContext = event.dragContext;

        var selectedShapes = selection.getSelection(),
            dragShapes = Array.prototype.slice.call(selectedShapes),
            dragGraphics = [];

        // add drag target to selection if not done already
        if (dragShapes.indexOf(element) === -1) {
          dragShapes.push(element);
        }

        _.forEach(dragShapes, function(s) {
          var gfx = shapes.getGraphicsByShape(s);
          dragGraphics.push(gfx);
        });

        // attach additional information to the drag context
        _.extend(dragContext, {
          shapes: dragShapes,
          graphics: dragGraphics
        });

        /**
         * An event indicating that a drag operation has started
         *
         * @memberOf MoveEvents
         *
         * @event shape.move.start
         * @type {Object}
         *
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical representation of the shape
         * @property {Object} dragContext the drag context
         */
        events.fire('shape.move.start', event);
      })
      .on('drag', function(event) {

        /**
         * An event indicating that a move happens during a drag operation
         *
         * @memberOf MoveEvents
         *
         * @event shape.move
         * @type {Object}
         *
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical representation of the shape
         * @property {Object} dragCtx the drag context
         */
        events.fire('shape.move', event);
      })
      .on('dragover', function(event) {

        /**
         * An event indicating that a shape is dragged over another shape
         *
         * @memberOf MoveEvents
         *
         * @event shape.move.over
         * @type {Object}
         *
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical object that is dragged over
         * @property {Object} dragContext the drag context
         */
        events.fire('shape.move.over', event);
      })
      .on('dragout', function(event) {

        /**
         * An event indicating that a shape is dragged out of another shape after
         * it had been previously dragged over it
         *
         * @memberOf MoveEvents
         *
         * @event shape.move.out
         * @type {Object}
         *
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical object that is dragged out
         * @property {Object} dragContext the drag context
         */
        events.fire('shape.move.out', event);
      })
      .on('dragend', function(event) {

        /**
         * An event indicating that a drag operation has ended
         *
         * @memberOf MoveEvents
         *
         * @event shape.move.end
         * @type {Object}
         *
         * @property {djs.ElementDescriptor} element the shape descriptor
         * @property {Object} gfx the graphical representation of the shape
         * @property {Object} dragCtx the drag context
         */
        events.fire('shape.move.end', event);

        if (!event.isDefaultPrevented()) {
          executeMove(event.dragContext);
        }
      })
      .on('dragcancel', function(event) {
        events.fire('shape.move.cancel', event);
      });
  }

  events.on('shape.added', function(event) {
    makeDraggable(event.element, event.gfx);
  });
}

Diagram.plugin('moveEvents', [
  'eventBus', 'selection', 'elementRegistry',
  'commandStack', 'interactionEvents', MoveEvents ]);

module.exports = MoveEvents;
},{"../../Diagram":"4B6uBI","../../commands/MoveShapesHandler":4,"../../core/CommandStack":6,"../../core/ElementRegistry":7,"../../core/EventBus":8,"../Draggable":16,"../InteractionEvents":17,"../selection/Service":23,"lodash":36}],21:[function(require,module,exports){
require('../../core/EventBus');
require('../../core/Canvas');
require('../../core/ElementRegistry');

require('../../draw/Snap');
require('../../draw/Styles');

require('../selection/Service');
require('../services/Rules');

require('../Outline');

require('./MoveEvents');

var Diagram = require('../../Diagram'),
    _ = require('lodash'),
    ShapeUtil = require('../../util/ShapeUtil');


/**
 * @class
 *
 * A plugin that makes shapes draggable / droppable.
 *
 * @param {EventBus} events the event bus
 * @param {Selection} selection the selection service
 * @param {ElementRegistry} shapes the shapes service
 * @param {Canvas} canvas the drawing canvas
 * @param {Snap} snap
 * @param {Styles} styles
 * @param {Rules} the rule engine
 */
function MoveVisuals(events, selection, shapes, canvas, snap, styles, rules) {

  var paper;

  function getGfx(s) {
    return shapes.getGraphicsByShape(s);
  }

  function getVisualDragShapes(shapeList) {
    return ShapeUtil.selfAndDirectChildren(shapeList, true);
  }

  function getAllChildShapes(shapeList) {
    return ShapeUtil.selfAndAllChildren(shapeList, true);
  }

  function removeDropMarkers(gfx) {
    gfx
      .removeClass('drop-ok')
      .removeClass('drop-not-ok');
  }

  function addDropMarkers(gfx, canDrop) {
    var marker = canDrop ? 'drop-ok' : 'drop-not-ok';
    gfx.addClass(marker);
  }

  function addDragger(shape, dragGroup) {
    var gfx = shapes.getGraphicsByShape(shape);
    var dragger = gfx.clone();
    var bbox = gfx.getBBox();

    dragger.attr(styles.cls('djs-dragger', [], {
      x: bbox.x,
      y: bbox.y
    }));

    dragGroup.add(dragger);
  }

  events.on('shape.move.start', function(event) {

    var dragContext = event.dragContext,
        dragShapes = dragContext.shapes;

    var dragGroup = paper.group().attr(styles.cls('djs-drag-group', [ 'no-events']));

    var visuallyDraggedShapes = getVisualDragShapes(dragShapes),
        allDraggedShapes = getAllChildShapes(dragShapes);

    visuallyDraggedShapes.forEach(function(s) {
      addDragger(s, dragGroup);
    });

    // cache all dragged gfx
    // so that we can quickly undo their state changes later
    var allDraggedGfx = dragContext.allDraggedGfx = allDraggedShapes.map(getGfx);

    allDraggedGfx.forEach(function(gfx) {
      gfx.addClass('djs-dragging');
    });

    dragContext.selection = selection.getSelection();
    dragContext.dragGroup = dragGroup;

    // deselect shapes
    selection.select(null);
  });

  events.on('shape.move', function(event) {

    var dragContext = event.dragContext,
        delta = dragContext.delta,
        dragGroup = dragContext.dragGroup;

    dragGroup.translate(delta.x, delta.y);
  });

  events.on('shape.move.over', function(event) {
    var dragContext = event.dragContext,
        gfx = event.gfx;

    var canDrop = rules.can('drop', dragContext);

    addDropMarkers(gfx, canDrop);
  });

  events.on('shape.move.out', function(event) {
    var gfx = event.gfx;
    removeDropMarkers(gfx);
  });

  events.on('shape.move.end', function(event) {

    var dragContext = event.dragContext,
        allDraggedGfx = dragContext.allDraggedGfx,
        dragGroup = dragContext.dragGroup;

    // cache all dragged gfx
    if (allDraggedGfx) {
      allDraggedGfx.forEach(function(gfx) {
        gfx.removeClass('djs-dragging');
      });
    }

    dragGroup.remove();

    if (dragContext.hoverGfx) {
      removeDropMarkers(dragContext.hoverGfx);
    }

    // restore selection
    selection.select(dragContext.selection);
  });


  // load paper from initialized canvas

  events.on('canvas.init', function(event) {
    paper = event.paper;
  });

  events.on('diagram.destroy', function() {
    paper = null;
  });
}

Diagram.plugin('moveVisuals', [
  'eventBus', 'selection', 'elementRegistry', 'canvas', 'snap', 'styles', 'rules', 'moveEvents', MoveVisuals
]);

module.exports = MoveVisuals;
},{"../../Diagram":"4B6uBI","../../core/Canvas":5,"../../core/ElementRegistry":7,"../../core/EventBus":8,"../../draw/Snap":12,"../../draw/Styles":13,"../../util/ShapeUtil":30,"../Outline":18,"../selection/Service":23,"../services/Rules":26,"./MoveEvents":20,"lodash":36}],22:[function(require,module,exports){
var diagramModule = require('../../di').defaultModule;

require('./MoveEvents');
require('./MoveVisuals');

function Move() {}

diagramModule.type('move', [ 'moveEvents', 'moveVisuals', Move ]);

module.exports = Move;
},{"../../di":10,"./MoveEvents":20,"./MoveVisuals":21}],23:[function(require,module,exports){
require('../../core/EventBus');

var Diagram = require('../../Diagram'),
    _ = require('lodash');


/**
 * @class
 *
 * A service that offers the current selection in a diagram.
 * Offers the api to control the selection, too.
 *
 * @param {EventBus} events the event bus
 */
function SelectionService(events) {

  var selectedElements = [];

  function getSelection() {
    return selectedElements;
  }

  function isSelected(shape) {
    return selectedElements.indexOf(shape) !== -1;
  }

  /**
   * This method selects one or more elements on the diagram.
   *
   * By passing an additional add parameter you can decide whether or not the element(s)
   * should be added to the already existing selection or not.
   *
   * @method Selection#select
   *
   * @param  {Object|Object[]} elements element or array of elements to be selected
   * @param  {boolean} [add] whether the element(s) should be appended to the current selection, defaults to false
   */
  function select(elements, add) {
    var oldSelection = selectedElements.slice();

    if (!_.isArray(elements)) {
      elements = elements ? [ elements ] : [];
    }

    // selection may be cleared by passing an empty array or null
    // to the method
    if (elements.length && add) {
      _.forEach(elements, function(element) {
        if (selectedElements.indexOf(element) !== -1) {
          // already selected
          return;
        } else {
          selectedElements.push(element);
        }
      });
    } else {
      selectedElements = elements.slice();
    }

    events.fire('selection.changed', { oldSelection: oldSelection, newSelection: selectedElements });
  }

  function deselect(element) {
    throw new Error('not implemented');
  }

  return {
    getSelection: getSelection,
    isSelected: isSelected,
    select: select,
    deselect: deselect
  };
}

Diagram.plugin('selection', [ 'eventBus', SelectionService ]);

module.exports = SelectionService;
},{"../../Diagram":"4B6uBI","../../core/EventBus":8,"lodash":36}],24:[function(require,module,exports){
require('../../core/EventBus');
require('../../core/ElementRegistry');


require('../InteractionEvents');
require('../Outline');

require('./Service');

var Diagram = require('../../Diagram'),
    _ = require('lodash');

/**
 * @class
 *
 * A plugin that adds a visible selection UI to shapes and connections
 * by appending the <code>hover</code> and <code>selected</code> classes to them.
 *
 * Makes elements selectable, too.
 *
 * @param {EventBus} events
 * @param {SelectionService} selection
 * @param {ElementRegistry} shapes
 */
function SelectionVisuals(events, selection, shapes) {

  var HOVER_CLS = 'hover',
      SELECTED_CLS = 'selected';

  function addMarker(gfx, cls) {
    gfx.addClass(cls);
  }

  function removeMarker(gfx, cls) {
    gfx.removeClass(cls);
  }

  /**
   * Wire click on shape to select the shape
   *
   * @param  {Object} event the fired event
   */
  events.on('shape.click', function(event) {
    var add = event.shiftKey;
    selection.select(event.element, add);
  });

  events.on('shape.hover', function(event) {
    addMarker(event.gfx, HOVER_CLS);
  });

  events.on('shape.out', function(event) {
    removeMarker(event.gfx, HOVER_CLS);
  });

  events.on('selection.changed', function(event) {

    function deselect(s) {
      addMarker(shapes.getGraphicsByShape(s), SELECTED_CLS);
    }

    function select(s) {
      removeMarker(shapes.getGraphicsByShape(s), SELECTED_CLS);
    }

    var oldSelection = event.oldSelection,
        newSelection = event.newSelection;

    _.forEach(oldSelection, function(e) {
      if (newSelection.indexOf(e) === -1) {
        select(e);
      }
    });

    _.forEach(newSelection, function(e) {
      if (oldSelection.indexOf(e) === -1) {
        deselect(e);
      }
    });
  });

  // intercept direct canvas clicks to deselect all
  // selected shapes
  events.on('canvas.init', function(event) {
    var paper = event.paper;

    paper.click(function(event) {
      if (event.srcElement === paper.node) {
        selection.select(null);
      }
    });
  });
}

Diagram.plugin('selectionVisuals', [
  'eventBus',
  'selection',
  'elementRegistry',
  'interactionEvents',
  'outline', SelectionVisuals ]);

module.exports = SelectionVisuals;
},{"../../Diagram":"4B6uBI","../../core/ElementRegistry":7,"../../core/EventBus":8,"../InteractionEvents":17,"../Outline":18,"./Service":23,"lodash":36}],25:[function(require,module,exports){
'use strict';

var Diagram = require('../../Diagram'),
    ShapeUtil = require('../../util/ShapeUtil');

var _ = require('lodash');


/**
 * @namespace djs
 */

/**
 * @class
 *
 * A service that allow to drop an element via drag (from palette)
 * to the canvas (drop).
 */
function PaletteDragDrop(canvas, events, elementRegistry) {

  var dragInProgress = false;

  events.on('standard.palette.init', function(event) {
    init();
  });

  function init() {
    // mouseenter does not work as chrome doesn't fire
    // the event if left button is pressed

    var paper = canvas.getPaper();
    paper.node.addEventListener('mousemove', paletteMoveListener);
    paper.node.addEventListener('mouseup', canvasOnMouseUp);

    document.addEventListener('mouseup', canvasOnMouseUpAnywhere);
    document.addEventListener('keyup', onEscapeKey);
  }

  /**
   * Handles what happen in the canvas
   */
  var paletteMoveListener = function paletteMoveListener() {
    if(dragInProgress) {
      // TODO dragging draw shape
    }
  };

  /**
   * What happens on mouseup event over canvas
   */
  var canvasOnMouseUp = function canvasOnMouseUp(mouseEvent) {
    if(dragInProgress && mouseEvent.button === 0) {
      var newShape = {
        x: mouseEvent.clientX - 90 / 2.5,
        y: mouseEvent.clientY - 90,
        width: 110,
        height: 110
      };
      canvas.addShape(newShape);
    }
    dragInProgress = false;
  };

  var canvasOnMouseUpAnywhere = function canvasOnMouseUpAnywhere() {
    dragInProgress = false;
  };

  var onEscapeKey = function(event) {
    if(event.keyCode === 27) {
      dragInProgress = false;
    }
  };


  /**
   * Must be called if a draggable button on palette is clicked
   * It is in the response of the palette to invoke this method.
   *
   * @return {boolean} true if dragStart was successful
   */
  var startDragAndDrop = function startDragAndDrop() {
    if(dragInProgress) {
      console.warn('Drag is still in progress');
      return false;
    }
    dragInProgress = true;
    return true;
  };

  /**
   * @return {boolean} returns the current dragging status.
   */
  var isDragInProgress = function isDragInProgress() {
     return isDragInProgress;
  };

  return {
    startDragAndDrop: startDragAndDrop,
    isDragInProgress: isDragInProgress
  };
}

Diagram.plugin('paletteDragDrop', ['canvas', 'eventBus', 'elementRegistry', PaletteDragDrop ]);

module.exports = PaletteDragDrop;
},{"../../Diagram":"4B6uBI","../../util/ShapeUtil":30,"lodash":36}],26:[function(require,module,exports){
require('../../core/EventBus');

var Diagram = require('../../Diagram'),
    _ = require('lodash');


/**
 * @class
 *
 * A service that provides rules for certain diagram actions.
 *
 * @param {Object} config the configuration passed to the diagram
 * @param {EventBus} events the event bus
 */
function Rules(config, events) {

  var DEFAULT_RESULT = false;

  /**
   * This method selects one or more elements on the diagram.
   *
   * By passing an additional add parameter you can decide whether or not the element(s)
   * should be added to the already existing selection or not.
   *
   * @method Selection#select
   *
   * @param  {String} action the action to be checked
   * @param  {Object} [context] the context to check the action in
   */
  function can(action, context) {
    return Math.random() > 0.3;
  }

  return {
    can: can
  };
}

Diagram.plugin('rules', ['config', 'eventBus', Rules ]);

},{"../../Diagram":"4B6uBI","../../core/EventBus":8,"lodash":36}],27:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('lodash');

/**
 * An event emitter for the browser that depends on lodash rather than node/util
 */

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}

module.exports = EventEmitter;


EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!util.isNumber(n) || n < 0)
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (util.isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (util.isUndefined(handler))
    return false;

  if (util.isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (util.isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              util.isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (util.isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (util.isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!util.isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  function g() {
    this.removeListener(type, g);
    listener.apply(this, arguments);
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (util.isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (util.isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (util.isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (util.isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (util.isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};
},{"lodash":36}],28:[function(require,module,exports){
function IdGenerator(prefix) {

  var current = 0;

  function next() {
    return (prefix || '') + current++;
  }

  return {
    next: next
  };
}

module.exports = IdGenerator;
},{}],29:[function(require,module,exports){
var _ = require('lodash');

var DEFAULT_BOX_PADDING = 5;

var DEFAULT_LABEL_SIZE = {
  width: 150,
  height: 50
};


function parseAlign(align) {

  var parts = align.split('-');

  return {
    horizontal: parts[0] || 'center',
    vertical: parts[1] || 'top'
  };
}

function parsePadding(padding) {

  if (_.isObject(padding)) {
    return _.extend({ top: 0, left: 0, right: 0, bottom: 0 }, padding);
  } else {
    return {
      top: padding,
      left: padding,
      right: padding,
      bottom: padding
    };
  }
}


/**
 * Creates a new label utility
 *
 * @param {Object} config
 * @param {Dimensions} config.size
 * @param {Number} config.padding
 * @param {Object} config.style
 * @param {String} config.align
 */
function LabelUtil(config) {

  config = _.extend({}, {
    size: DEFAULT_LABEL_SIZE,
    padding: DEFAULT_BOX_PADDING,
    style: {},
    align: 'center-top'
  }, config || {});

  /**
   * Create a label in the parent node.
   *
   * @method LabelUtil#createLabel
   *
   * @param {SVGElement} parent the parent to draw the label on
   * @param {String} text the text to render on the label
   * @param {Object} options
   * @param {String} options.align how to align in the bounding box.
   *                             Any of { 'center-middle', 'center-top' }, defaults to 'center-top'.
   * @param {String} options.style style to be applied to the text
   *
   * @return {SVGText} the text element created
   */
  function createLabel(parent, text, options) {

    var box = _.merge({}, config.size, options.box || {}),
        style = _.merge({}, config.style, options.style || {}),
        align = parseAlign(options.align || config.align),
        padding = parsePadding(options.padding !== undefined ? options.padding : config.padding);

    var lines = text.split(/\r?\n/g),
        layouted = [];

    var maxWidth = box.width - padding.left - padding.right;

    /**
     * Layout the next line and return the layouted element.
     *
     * Alters the lines passed.
     *
     * @param  {Array<String>} lines
     * @return {Object} the line descriptor, an object { width, height, text }
     */
    function layoutNext(lines) {

      var originalLine = lines.shift(),
          fitLine = originalLine;

      var textBBox;

      function fit() {
        if (fitLine.length < originalLine.length) {
          var nextLine = lines[0] || '',
              remainder = originalLine.slice(fitLine.length);

          if (/-\s*$/.test(remainder)) {
            nextLine = remainder.replace(/-\s*$/, '') + nextLine.replace(/^\s+/, '');
          } else {
            nextLine = remainder + ' ' + nextLine;
          }

          lines[0] = nextLine;
        }
        return { width: textBBox.width, height: textBBox.height, text: fitLine };
      }

      function getTextBBox(text) {
        var textElement = parent.text(0, 0, fitLine).attr(style);

        var bbox = textElement.getBBox();

        textElement.remove();
        return bbox;
      }

      /**
       * Shortens a line based on spacing and hyphens.
       * Returns the shortened result on success.
       *
       * @param  {String} line
       * @param  {Number} maxLength the maximum characters of the string
       * @return {String} the shortened string
       */
      function semanticShorten(line, maxLength) {
        var parts = line.split(/(\s|-)/g),
            part,
            shortenedParts = [],
            length = 0;

        // try to shorten via spaces + hyphens
        if (parts.length > 1) {
          while ((part = parts.shift())) {

            if (part.length + length < maxLength) {
              shortenedParts.push(part);
              length += part.length;
            } else {
              // remove previous part, too if hyphen does not fit anymore
              if (part === '-') {
                shortenedParts.pop();
              }

              break;
            }
          }
        }

        return shortenedParts.join('');
      }

      function shortenLine(line, width, maxWidth) {
        var shortenedLine = '';

        var approximateLength = line.length * (maxWidth / width);

        // try to shorten semantically (i.e. based on spaces and hyphens)
        shortenedLine = semanticShorten(line, approximateLength);

        if (!shortenedLine) {

          // force shorten by cutting the long word
          shortenedLine = line.slice(0, Math.floor(approximateLength - 1));
        }

        return shortenedLine;
      }


      while (true) {

        textBBox = getTextBBox(fitLine);

        // try to fit
        if (textBBox.width < maxWidth) {
          return fit();
        }

        fitLine = shortenLine(fitLine, textBBox.width, maxWidth);
      }
    }

    while (lines.length) {
      layouted.push(layoutNext(lines));
    }

    var totalHeight = _.reduce(layouted, function(sum, line, idx) {
      return sum + line.height;
    }, 0);


    // the center x position to align against
    var cx = box.width / 2;

    // the y position of the next line
    var y, x;

    switch (align.vertical) {
      case 'middle':
        y = (box.height - totalHeight) / 2 - layouted[0].height / 4;
        break;

      default:
        y = padding.top;
    }

    var textElement = parent.group().attr(style);

    _.forEach(layouted, function(line) {
      y += line.height;

      switch (align.horizontal) {
        case 'left':
          x = padding.left;
          break;

        case 'right':
          x = (maxWidth - padding.right - line.width);
          break;

        default:
          // aka center
          x = (maxWidth - line.width) / 2 + padding.left;
      }


      parent.text(x, y, line.text).appendTo(textElement);
    });

    return textElement;
  }

  // API
  this.createLabel = createLabel;
}


module.exports = LabelUtil;
},{"lodash":36}],30:[function(require,module,exports){
var _ = require('lodash');

/**
 * Adds an element to a collection and returns true if the
 * element was added.
 *
 * @param {Object[]} elements
 * @param {Object} e
 * @param {Boolean} unique
 */
function add(elements, e, unique) {
  var canAdd = !unique || elements.indexOf(e) === -1;

  if (canAdd) {
    elements.push(e);
  }

  return canAdd;
}

function each(shapes, fn, depth) {

  depth = depth || 0;

  _.forEach(shapes, function(s, i) {
    var filter = fn(s, i, depth);

    if (_.isArray(filter) && filter.length) {
      each(filter, fn, depth + 1);
    }
  });
}

/**
 * Collects self + child shapes up to a given depth from a list of shapes.
 *
 * @param  {djs.ShapeDescriptor[]} shapes the shapes to select the children from
 * @param  {Boolean} unique whether to return a unique result set (no duplicates)
 * @param  {Number} maxDepth the depth to search through or -1 for infinite
 *
 * @return {djs.ShapeDescriptor[]} found shapes
 */
function selfAndChildren(shapes, unique, maxDepth) {
  var result = [],
      processedChildren = [];

  each(shapes, function(shape, i, depth) {
    add(result, shape, unique);

    var children = shape.children;

    // max traversal depth not reached yet
    if (maxDepth === -1 || depth < maxDepth) {

      // children exist && children not yet processed
      if (children && add(processedChildren, children, unique)) {
        return children;
      }
    }
  });

  return result;
}

/**
 * Return self + direct children for a number of shapes
 *
 * @param  {djs.ShapeDescriptor[]} shapes to query
 * @param  {Boolean} allowDuplicates to allow duplicates in the result set
 *
 * @return {djs.ShapeDescriptor[]} the collected shapes
 */
function selfAndDirectChildren(shapes, allowDuplicates) {
  return selfAndChildren(shapes, !allowDuplicates, 1);
}

/**
 * Return self + ALL children for a number of shapes
 *
 * @param  {djs.ShapeDescriptor[]} shapes to query
 * @param  {Boolean} allowDuplicates to allow duplicates in the result set
 *
 * @return {djs.ShapeDescriptor[]} the collected shapes
 */
function selfAndAllChildren(shapes, allowDuplicates) {
  return selfAndChildren(shapes, !allowDuplicates, -1);
}

/**
 * Translate a shape
 * Move shape to shape.x + x and shape.y + y
 */
function translateShape(shape, x, y) {
  'use strict';

  shape.x += x;
  shape.y += y;
}

function setParent(shape, newParent) {
  // TODO(nre): think about parent->child magic

  var old = shape.parent;
  if (old && old.children) {
    var idx = old.children.indexOf(shape);
    if (idx !== -1) {
      old.children.splice(idx, 1);
    }
  }

  if (newParent) {
    if (!newParent.children) {
      newParent.children = [];
    }

    newParent.children.push(shape);
  }

  shape.parent = newParent;

  return old;
}

module.exports.eachShape = each;
module.exports.selfAndDirectChildren = selfAndDirectChildren;
module.exports.selfAndAllChildren = selfAndAllChildren;
module.exports.translateShape = translateShape;
module.exports.setParent = setParent;
},{"lodash":36}],31:[function(require,module,exports){
/**
 * @module util/svgUtil
 */

function is(e, cls) {
  return e.hasClass(cls);
}


/**
 *
 * A note on how SVG elements are structured:
 *
 * Shape layout:
 *
 * [group.djs-group.djs-shape]
 *  |-> [rect.djs-hit]
 *  |-> [rect.djs-visual]
 *  |-> [rect.djs-outline]
 *  ...
 *
 * [group.djs-group.djs-connection]
 *  |-> [polyline.djs-hit]
 *  |-> [polyline.djs-visual]
 *  |-> [polyline.djs-outline]
 *  ...
 *
 */

/**
 * Returns the visual part of a diagram element
 *
 * @param  {snapsvg.Element} gfx
 * @return {snapsvg.Element}
 */
function getVisual(gfx) {
  return gfx.select('.djs-visual');
}

module.exports.getVisual = getVisual;
},{}],32:[function(require,module,exports){

var isArray = function(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
};

var annotate = function() {
  var args = Array.prototype.slice.call(arguments);
  
  if (args.length === 1 && isArray(args[0])) {
    args = args[0];
  }

  var fn = args.pop();

  fn.$inject = args;

  return fn;
};


// Current limitations:
// - can't put into "function arg" comments
// function /* (no parenthesis like this) */ (){}
// function abc( /* xx (no parenthesis like this) */ a, b) {}
//
// Just put the comment before function or inside:
// /* (((this is fine))) */ function(a, b) {}
// function abc(a) { /* (((this is fine))) */}

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG = /\/\*([^\*]*)\*\//m;

var parse = function(fn) {
  if (typeof fn !== 'function') {
    throw new Error('Cannot annotate "' + fn + '". Expected a function!');
  }

  var match = fn.toString().match(FN_ARGS);
  return match[1] && match[1].split(',').map(function(arg) {
    match = arg.match(FN_ARG);
    return match ? match[1].trim() : arg.trim();
  }) || [];
};


exports.annotate = annotate;
exports.parse = parse;
exports.isArray = isArray;

},{}],33:[function(require,module,exports){
module.exports = {
  annotate: require('./annotation').annotate,
  Module: require('./module'),
  Injector: require('./injector')
};

},{"./annotation":32,"./injector":34,"./module":35}],34:[function(require,module,exports){
var Module = require('./module');
var autoAnnotate = require('./annotation').parse;
var annotate = require('./annotation').annotate;
var isArray = require('./annotation').isArray;


var Injector = function(modules, parent) {
  parent = parent || {
    get: function(name) {
      currentlyResolving.push(name);
      throw error('No provider for "' + name + '"!');
    }
  };

  var currentlyResolving = [];
  var providers = this._providers = Object.create(parent._providers || null);
  var instances = this._instances = Object.create(null);

  var self = instances.injector = this;

  var error = function(msg) {
    var stack = currentlyResolving.join(' -> ');
    currentlyResolving.length = 0;
    return new Error(stack ? msg + ' (Resolving: ' + stack + ')' : msg);
  };

  var get = function(name) {
    if (!providers[name] && name.indexOf('.') !== -1) {
      var parts = name.split('.');
      var pivot = get(parts.shift());

      while(parts.length) {
        pivot = pivot[parts.shift()];
      }

      return pivot;
    }

    if (Object.hasOwnProperty.call(instances, name)) {
      return instances[name];
    }

    if (Object.hasOwnProperty.call(providers, name)) {
      if (currentlyResolving.indexOf(name) !== -1) {
        currentlyResolving.push(name);
        throw error('Cannot resolve circular dependency!');
      }

      currentlyResolving.push(name);
      instances[name] = providers[name][0](providers[name][1]);
      currentlyResolving.pop();

      return instances[name];
    }

    return parent.get(name);
  };

  var instantiate = function(Type) {
    var instance = Object.create(Type.prototype);
    var returned = invoke(Type, instance);

    return typeof returned === 'object' ? returned : instance;
  };

  var invoke = function(fn, context) {
    if (typeof fn !== 'function') {
      if (isArray(fn)) {
        fn = annotate(fn.slice());
      } else {
        throw new Error('Cannot invoke "' + fn + '". Expected a function!');
      }
    }

    var inject = fn.$inject && fn.$inject || autoAnnotate(fn);
    var dependencies = inject.map(function(dep) {
      return get(dep);
    });

    // TODO(vojta): optimize without apply
    return fn.apply(context, dependencies);
  };


  var createPrivateInjectorFactory = function(privateChildInjector) {
    return annotate(function(key) {
      return privateChildInjector.get(key);
    });
  };

  var createChild = function(modules, forceNewInstances) {
    if (forceNewInstances && forceNewInstances.length) {
      var fromParentModule = Object.create(null);
      var matchedScopes = Object.create(null);

      var privateInjectorsCache = [];
      var privateChildInjectors = [];
      var privateChildFactories = [];

      var provider;
      var cacheIdx;
      var privateChildInjector;
      var privateChildInjectorFactory;
      for (var name in providers) {
        provider = providers[name];

        if (forceNewInstances.indexOf(name) !== -1) {
          if (provider[2] === 'private') {
            cacheIdx = privateInjectorsCache.indexOf(provider[3]);
            if (cacheIdx === -1) {
              privateChildInjector = provider[3].createChild([], forceNewInstances);
              privateChildInjectorFactory = createPrivateInjectorFactory(privateChildInjector);
              privateInjectorsCache.push(provider[3]);
              privateChildInjectors.push(privateChildInjector);
              privateChildFactories.push(privateChildInjectorFactory);
              fromParentModule[name] = [privateChildInjectorFactory, name, 'private', privateChildInjector];
            } else {
              fromParentModule[name] = [privateChildFactories[cacheIdx], name, 'private', privateChildInjectors[cacheIdx]];
            }
          } else {
            fromParentModule[name] = [provider[2], provider[1]];
          }
          matchedScopes[name] = true;
        }

        if ((provider[2] === 'factory' || provider[2] === 'type') && provider[1].$scope) {
          forceNewInstances.forEach(function(scope) {
            if (provider[1].$scope.indexOf(scope) !== -1) {
              fromParentModule[name] = [provider[2], provider[1]];
              matchedScopes[scope] = true;
            }
          });
        }
      }

      forceNewInstances.forEach(function(scope) {
        if (!matchedScopes[scope]) {
          throw new Error('No provider for "' + scope + '". Cannot use provider from the parent!');
        }
      });

      modules.unshift(fromParentModule);
    }

    return new Injector(modules, self);
  };

  var factoryMap = {
    factory: invoke,
    type: instantiate,
    value: function(value) {
      return value;
    }
  };

  modules.forEach(function(module) {

    function arrayUnwrap(type, value) {
      if (type !== 'value' && isArray(value)) {
        value = annotate(value.slice());
      }

      return value;
    }

    // TODO(vojta): handle wrong inputs (modules)
    if (module instanceof Module) {
      module.forEach(function(provider) {
        var name = provider[0];
        var type = provider[1];
        var value = provider[2];

        providers[name] = [factoryMap[type], arrayUnwrap(type, value), type];
      });
    } else if (typeof module === 'object') {
      if (module.__exports__) {
        var clonedModule = Object.keys(module).reduce(function(m, key) {
          if (key.substring(0, 2) !== '__') {
            m[key] = module[key];
          }
          return m;
        }, Object.create(null));

        var privateInjector = new Injector((module.__modules__ || []).concat([clonedModule]), self);
        var getFromPrivateInjector = annotate(function(key) {
          return privateInjector.get(key);
        });
        module.__exports__.forEach(function(key) {
          providers[key] = [getFromPrivateInjector, key, 'private', privateInjector];
        });
      } else {
        Object.keys(module).forEach(function(name) {
          if (module[name][2] === 'private') {
            providers[name] = module[name];
            return;
          }

          var type = module[name][0];
          var value = module[name][1];

          providers[name] = [factoryMap[type], arrayUnwrap(type, value), type];
        });
      }
    }
  });

  // public API
  this.get = get;
  this.invoke = invoke;
  this.instantiate = instantiate;
  this.createChild = createChild;
};

module.exports = Injector;

},{"./annotation":32,"./module":35}],35:[function(require,module,exports){
var Module = function() {
  var providers = [];

  this.factory = function(name, factory) {
    providers.push([name, 'factory', factory]);
    return this;
  };

  this.value = function(name, value) {
    providers.push([name, 'value', value]);
    return this;
  };

  this.type = function(name, type) {
    providers.push([name, 'type', type]);
    return this;
  };

  this.forEach = function(iterator) {
    providers.forEach(iterator);
  };
};

module.exports = Module;

},{}],36:[function(require,module,exports){
module.exports = window._ || require('../node_modules/lodash');
},{"../node_modules/lodash":"9TlSmm"}],37:[function(require,module,exports){
var Snap = window.Snap;
module.exports = Snap || require('../node_modules/snapsvg');

},{"../node_modules/snapsvg":"BY30BN"}]},{},["4B6uBI",3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31])