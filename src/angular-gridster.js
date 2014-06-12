'use strict';

angular.module('gridster', [])

.constant('gridsterConfig', {
	columns: 6, // number of columns in the grid
	width: 'auto', // the width of the grid. "auto" will expand the grid to its parent container
	colWidth: 'auto', // the width of the columns. "auto" will divide the width of the grid evenly among the columns
	rowHeight: 'match', // the height of the rows. "match" will set the row height to be the same as the column width
	margins: [10, 10], // the margins in between grid items
	isMobile: false, // toggle mobile view
	minColumns: 1, // the minimum amount of columns the grid can scale down to
	minRows: 1, // the minimum amount of rows to show if the grid is empty
	maxRows: 100, // the maximum amount of rows in the grid
	defaultSizeX: 2, // the default width of a item
	defaultSizeY: 1, // the default height of a item
	mobileBreakPoint: 600, // the width threshold to toggle mobile mode
	resizable: { // options to pass to jquery ui resizable
		enabled: true
	},
	draggable: { // options to pass to jquery ui draggable
		enabled: true
	}
})

.controller('GridsterCtrl', ['gridsterConfig',
	function(gridsterConfig) {

		/**
		 * Create options from gridsterConfig constant
		 */
		this.options = angular.extend({}, gridsterConfig);

		/**
		 * A positional array of the items in the grid
		 */
		this.grid = [];

		/**
		 * Preview holder element
		 */
		this.$preview = null;

		/**
		 * Gridster element
		 */
		this.$element = null;

		/**
		 * Sets gridster & preview elements
		 *
		 * @param {object} $element Gridster element
		 * @param {object} $preview Gridster preview element
		 */
		this.init = function($element, $preview) {
			this.$element = $element;
			this.$preview = $preview;
		};

		/**
		 * Clean up after yourself
		 */
		this.destroy = function() {
			this.options = this.options.margins = this.grid = this.$element = this.$preview = null;
		};

		/**
		 * Overrides default options
		 *
		 * @param {object} options The options to override
		 */
		this.setOptions = function(options) {
			angular.extend(this.options, options);

			// resolve "auto" & "match" values
			if (this.options.width === 'auto') {
				this.options.curWidth = this.$element.width();
			} else {
				this.options.curWidth = this.options.width;
			}
			if (this.options.colWidth === 'auto') {
				this.options.curColWidth = (this.options.curWidth - this.options.margins[1]) / this.options.columns;
			} else {
				this.options.curColWidth = this.options.colWidth;
			}
			if (this.options.rowHeight === 'match') {
				this.options.curRowHeight = this.options.curColWidth;
			} else {
				this.options.curRowHeight = this.options.rowHeight;
			}
		};

		/**
		 * Redraws the grid
		 */
		this.redraw = function() {
			this.setOptions();

			this.options.isMobile = this.options.curWidth <= this.options.mobileBreakPoint;

			// loop through all items and reset their CSS
			for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
					if (columns[colIndex]) {
						var item = columns[colIndex];
						var $el = item.$element;
						this.setElementPosition($el, item.row, item.col);
						this.setElementSizeY($el, item.sizeY);
						this.setElementSizeX($el, item.sizeX);
					}
				}
			}
		};

		/**
		 * Check if item can occupy a specified position in the grid
		 *
		 * @param {object} item The item in question
		 * @param {number} row The row index
		 * @param {number} column The column index
		 * @returns {boolean} True if if item fits
		 */
		this.canItemOccupy = function(item, row, column) {
			return row > -1 && column > -1 && item.sizeX + column <= this.options.columns;
		};

		/**
		 * Set the item in the first suitable position
		 *
		 * @param {object} item The item to insert
		 */
		this.autoSetItemPosition = function(item) {
			// walk through each row and column looking for a place it will fit
			for (var rowIndex = 0; rowIndex < this.options.maxRows; ++rowIndex) {
				for (var colIndex = 0; colIndex < this.options.columns; ++colIndex) {
					// only insert if position is not already taken and it can fit
					var items = this.getItems(rowIndex, colIndex, item.sizeX, item.sizeY, item);
					if (items.length === 0 && this.canItemOccupy(item, rowIndex, colIndex)) {
						this.putItem(item, rowIndex, colIndex);
						return;
					}
				}
			}
			throw new Error('Unable to place item!');
		};

		/**
		 * Gets items at a specific coordinate
		 *
		 * @param {number} row
		 * @param {number} column
		 * @param {number} sizeX
		 * @param {number} sizeY
		 * @param {array} excludeItems An array of items to exclude from selection
		 * @returns {array} Items that match the criteria
		 */
		this.getItems = function(row, column, sizeX, sizeY, excludeItems) {
			var items = [];
			if (!sizeX || !sizeY) {
				sizeX = sizeY = 1;
			}
			if (excludeItems && !(excludeItems instanceof Array)) {
				excludeItems = [excludeItems];
			}
			for (var h = 0; h < sizeY; ++h) {
				for (var w = 0; w < sizeX; ++w) {
					var item = this.getItem(row + h, column + w, excludeItems);
					if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && items.indexOf(item) === -1) {
						items.push(item);
					}
				}
			}
			return items;
		};

		/**
		 * Removes an item from the grid
		 *
		 * @param {object} item
		 */
		this.removeItem = function(item) {
			for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				var index = columns.indexOf(item);
				if (index !== -1) {
					columns[index] = null;
					break;
				}
			}
			this.floatItemsUp();
			this.updateHeight();
		};

		/**
		 * Returns the item at a specified coordinate
		 *
		 * @param {number} row
		 * @param {number} column
		 * @param {array} excludeitems Items to exclude from selection
		 * @returns {object} The matched item or null
		 */
		this.getItem = function(row, column, excludeItems) {
			if (excludeItems && !(excludeItems instanceof Array)) {
				excludeItems = [excludeItems];
			}
			var sizeY = 1;
			while (row > -1) {
				var sizeX = 1,
					col = column;
				while (col > -1) {
					var items = this.grid[row];
					if (items) {
						var item = items[col];
						if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && item.sizeX >= sizeX && item.sizeY >= sizeY) {
							return item;
						}
					}
					++sizeX;
					--col;
				}
				--row;
				++sizeY;
			}
			return null;
		};

		/**
		 * Insert an array of items into the grid
		 *
		 * @param {array} items An array of items to insert
		 */
		this.putItems = function(items) {
			for (var i = 0, l = items.length; i < l; ++i) {
				this.putItem(items[i]);
			}
		};

		/**
		 * Insert a single item into the grid
		 *
		 * @param {object} item The item to insert
		 * @param {number} row (Optional) Specifies the items row index
		 * @param {number} column (Optional) Specifies the items column index
		 */
		this.putItem = function(item, row, column) {
			if (typeof row === 'undefined' || row === null) {
				row = item.row;
				column = item.col;
				if (typeof row === 'undefined' || row === null) {
					this.autoSetItemPosition(item);
					return;
				}
			}
			if (!this.canItemOccupy(item, row, column)) {
				column = Math.min(this.options.columns - item.sizeX, Math.max(0, column));
				row = Math.max(0, row);
			}

			if (item && item.oldRow !== null && typeof item.oldRow !== 'undefined') {
				if (item.oldRow === row && item.oldColumn === column) {
					item.row = row;
					item.col = column;
					return;
				} else {
					// remove from old position
					var oldRow = this.grid[item.oldRow];
					if (oldRow && oldRow[item.oldColumn] === item) {
						delete oldRow[item.oldColumn];
					}
				}
			}

			item.oldRow = item.row = row;
			item.oldColumn = item.col = column;

			this.moveOverlappingItems(item);

			if (!this.grid[row]) {
				this.grid[row] = [];
			}
			this.grid[row][column] = item;
		};

		/**
		 * Prevents items from being overlapped
		 *
		 * @param {object} item The item that should remain
		 */
		this.moveOverlappingItems = function(item) {
			var items = this.getItems(
				item.row,
				item.col,
				item.sizeX,
				item.sizeY,
				item
			);
			this.moveItemsDown(items, item.row + item.sizeY);
		};

		/**
		 * Moves an array of items to a specified row
		 *
		 * @param {array} items The items to move
		 * @param {number} row The target row
		 */
		this.moveItemsDown = function(items, row) {
			if (!items || items.length === 0) {
				return;
			}
			var topRows = {},
				item, i, l;
			// calculate the top rows in each column
			for (i = 0, l = items.length; i < l; ++i) {
				item = items[i];
				var topRow = topRows[item.col];
				if (typeof topRow === 'undefined' || item.row < topRow) {
					topRows[item.col] = item.row;
				}
			}
			// move each item down from the top row in its column to the row
			for (i = 0, l = items.length; i < l; ++i) {
				item = items[i];
				var columnOffset = row - topRows[item.col];
				this.putItem(
					item,
					item.row + columnOffset,
					item.col
				);
			}
		};

		/**
		 * Moves all items up as much as possible
		 */
		this.floatItemsUp = function() {
			for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
					if (columns[colIndex]) {
						this.floatItemUp(columns[colIndex]);
					}
				}
			}
		};

		/**
		 * Float an item up to the most suitable row
		 *
		 * @param {object} item The item to move
		 */
		this.floatItemUp = function(item) {
			var colIndex = item.col,
				sizeY = item.sizeY,
				sizeX = item.sizeX,
				bestRow = null,
				bestColumn = null,
				rowIndex = item.row - 1;

			while (rowIndex > -1) {
				var items = this.getItems(rowIndex, colIndex, sizeX, sizeY, item);
				if (items.length !== 0) {
					break;
				}
				bestRow = rowIndex;
				bestColumn = colIndex;
				--rowIndex;
			}
			if (bestRow !== null) {
				this.putItem(item, bestRow, bestColumn);
			}
		};

		/**
		 * Update gridsters height
		 *
		 * @param {number} plus (Optional) Additional height to add
		 */
		this.updateHeight = function(plus) {
			var maxHeight = this.options.minRows;
			if (!plus) {
				plus = 0;
			}
			for (var rowIndex = this.grid.length; rowIndex >= 0; --rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
					if (columns[colIndex]) {
						maxHeight = Math.max(maxHeight, rowIndex + plus + columns[colIndex].sizeY);
					}
				}
			}
			this.options.gridHeight = Math.min(this.options.maxRows, maxHeight);
		};

		/**
		 * Returns the number of rows that will fit in given amount of pixels
		 *
		 * @param {number} pixels
		 * @param {boolean} ceilOrFloor (Optional) Determines rounding method
		 */
		this.pixelsToRows = function(pixels, ceilOrFloor) {
			if (ceilOrFloor === true) {
				return Math.ceil(pixels / this.options.curRowHeight);
			} else if (ceilOrFloor === false) {
				return Math.floor(pixels / this.options.curRowHeight);
			}

			return Math.round(pixels / this.options.curRowHeight);
		};

		/**
		 * Returns the number of columns that will fit in a given amount of pixels
		 *
		 * @param {number} pixels
		 * @param {boolean} ceilOrFloor (Optional) Determines rounding method
		 * @returns {number} The number of columns
		 */
		this.pixelsToColumns = function(pixels, ceilOrFloor) {
			if (ceilOrFloor === true) {
				return Math.ceil(pixels / this.options.curColWidth);
			} else if (ceilOrFloor === false) {
				return Math.floor(pixels / this.options.curColWidth);
			}

			return Math.round(pixels / this.options.curColWidth);
		};

		/**
		 * Sets an elements position on the page
		 *
		 * @param {object} $el The element to position
		 * @param {number} row
		 * @param {number} column
		 */
		this.setElementPosition = function($el, row, column) {
			if (this.options.isMobile) {
				$el.css({
					margin: this.options.margins[0] + 'px',
					top: 'auto',
					left: 'auto'
				});
			} else {
				$el.css({
					margin: 0,
					top: row * this.options.curRowHeight + this.options.margins[0],
					left: column * this.options.curColWidth + this.options.margins[1]
				});
			}
		};

		/**
		 * Sets an elements height
		 *
		 * @param {object} $el The element to resize
		 * @param {number} rows The number of rows the element occupies
		 */
		this.setElementSizeY = function($el, rows) {
			if (this.options.isMobile) {
				$el.css('height', 'auto');
			} else {
				$el.css('height', (rows * this.options.curRowHeight) - this.options.margins[0] + 'px');
			}
		};

		/**
		 * Sets an elements width
		 *
		 * @param {object} $el The element to resize
		 * @param {number} columns The number of columns the element occupies
		 */
		this.setElementSizeX = function($el, columns) {
			if (this.options.isMobile) {
				$el.css('width', 'auto');
			} else {
				$el.css('width', (columns * this.options.curColWidth) - this.options.margins[1] + 'px');
			}
		};
	}
])

/**
 * The gridster directive
 *
 * @param {object} $parse
 * @param {object} $timeout
 */
.directive('gridster', ['$timeout', '$rootScope', '$window',
	function($timeout, $rootScope, $window) {
		return {
			restrict: 'EAC',
			// without transclude, some child items may lose their parent scope
			transclude: true,
			replace: true,
			template: '<div ng-transclude></div>',
			controller: 'GridsterCtrl',
			scope: {
				config: '=?gridster'
			},
			compile: function($elem) {
				$elem.addClass('gridster');

				return function(scope, $elem, attrs, controller) {
					$elem.removeClass('gridster-loaded');

					var $preview = angular.element('<div class="gridster-item gridster-preview-holder"></div>').appendTo($elem);

					scope.config = scope.config || {};

					// update grid items on config changes
					scope.$watch('config', function(newOptions, oldOptions) {
						if (!newOptions || newOptions === oldOptions) {
							return;
						}

						controller.setOptions(newOptions);

						controller.redraw();
						updateHeight();
					}, true);

					scope.$watch('config.draggable', function() {
						$rootScope.$broadcast('draggable-changed');
					}, true);

					scope.$watch('config.resizable', function() {
						$rootScope.$broadcast('resizable-changed');
					}, true);

					var updateHeight = function() {
						controller.$element.css('height', (controller.options.gridHeight * controller.options.curRowHeight) + controller.options.margins[0] + 'px');
					};

					scope.$watch(function() {
						return controller.options.gridHeight;
					}, updateHeight);

					scope.$watch(function() {
						return controller.options.isMobile;
					}, function(isMobile) {
						if (isMobile) {
							controller.$element.addClass('gridster-mobile');
						} else {
							controller.$element.removeClass('gridster-mobile');
						}
					});

					var prevWidth = $elem.width();

					function resize() {
						var width = $elem.width();
						if (width === prevWidth || $elem.find('.gridster-item-moving').length > 0) {
							return;
						}
						prevWidth = width;
						$elem.removeClass('gridster-loaded');
						controller.redraw();
						updateHeight();


						if (typeof controller.options.resizable !== 'undefined' && controller.options.resizable.enabled) {
							scope.$broadcast('gridster-resized', [width, $elem.height()]);
						}

						$elem.addClass('gridster-loaded');
					}

					function onResize() {
						resize();
						scope.$apply();
					}
					if (typeof $elem.resize === 'function') {
						$elem.resize(onResize);
					}
					var $win = angular.element($window);
					$win.on('resize', onResize);

					scope.$watch(function() {
						return $elem.width();
					}, resize);

					scope.$on('$destroy', function() {
						this.$preview.remove();
						controller.destroy();
						$win.off('resize', onResize);
					});

					controller.init($elem, $preview);
					controller.setOptions(scope.config);
					controller.redraw();

					$timeout(function() {
						controller.floatItemsUp();
						$elem.addClass('gridster-loaded');
					}, 100);
				};
			}
		};
	}
])

.controller('GridsterItemCtrl', function() {
	this.$element = null;
	this.gridster = null;
	this.dragging = false;
	this.resizing = false;
	this.row = null;
	this.col = null;
	this.sizeX = null;
	this.sizeY = null;

	this.init = function($element, gridster) {
		this.$element = $element;
		this.gridster = gridster;
		this.sizeX = gridster.options.defaultSizeX;
		this.sizeY = gridster.options.defaultSizeY;
	};

	this.destroy = function() {
		this.gridster = null;
		this.$element = null;
	};

	/**
	 * Returns the items most important attributes
	 */
	this.toJSON = function() {
		return {
			row: this.row,
			col: this.col,
			sizeY: this.sizeY,
			sizeX: this.sizeX
		};
	};

	/**
	 * Set the items position
	 *
	 * @param {number} row
	 * @param {number} column
	 */
	this.setPosition = function(row, column) {
		this.gridster.putItem(this, row, column);
		if (this.gridster.$element.hasClass('gridster-loaded')) {
			this.gridster.floatItemsUp();
		}

		this.gridster.updateHeight(this.dragging ? this.sizeY : 0);

		if (this.dragging) {
			this.gridster.setElementPosition(this.gridster.$preview, this.row, this.col);
		} else {
			this.gridster.setElementPosition(this.$element, this.row, this.col);
		}
	};

	/**
	 * Sets a specified size property
	 *
	 * @param {string} key Can be either "x" or "y"
	 * @param {number} value The size amount
	 */
	this.setSize = function(key, value) {
		key = key.toUpperCase();
		var camelCase = 'size' + key,
			titleCase = 'Size' + key;
		if (value === '') {
			return;
		}
		value = parseInt(value, 10);
		if (isNaN(value) || value === 0) {
			value = this.gridster.options['default' + titleCase];
		}
		var changed = !(this[camelCase] === value && this['old' + titleCase] && this['old' + titleCase] === value);
		this['old' + titleCase] = this[camelCase] = value;

		if (this.resizing) {
			this.gridster.setElementPosition(this.gridster.$preview, this.row, this.col);
			this.gridster['setElement' + titleCase](this.gridster.$preview, value);
		} else {
			this.gridster['setElement' + titleCase](this.$element, value);
		}
		if (changed) {
			this.gridster.moveOverlappingItems(this);
			this.gridster.floatItemsUp();
			this.gridster.updateHeight(this.dragging ? this.sizeY : 0);
		}
	};

	/**
	 * Sets the items sizeY property
	 *
	 * @param {number} rows
	 */
	this.setSizeY = function(rows) {
		this.setSize('y', rows);
	};

	/**
	 * Sets the items sizeX property
	 *
	 * @param {number} rows
	 */
	this.setSizeX = function(columns) {
		this.setSize('x', columns);
	};
})

/**
 * GridsterItem directive
 *
 * @param {object} $parse
 * @param {object} $controller
 * @param {object} $timeout
 */
.directive('gridsterItem', ['$parse', '$controller', '$timeout',
	function($parse, $controller, $timeout) {
		return {
			restrict: 'EAC',
			require: '^gridster',
			link: function(scope, $el, attrs, gridster) {
				var optionsKey = attrs.gridsterItem,
					options;

				var item = $controller('GridsterItemCtrl'),
					draggablePossible = typeof $el.draggable === 'function',
					resizablePossible = typeof $el.resizable === 'function';

				//bind the items position properties
				if (optionsKey) {
					var $optionsGetter = $parse(optionsKey);
					options = $optionsGetter(scope) || {};
					if (!options && $optionsGetter.assign) {
						options = {
							row: item.row,
							col: item.col,
							sizeX: item.sizeX,
							sizeY: item.sizeY
						};
						$optionsGetter.assign(scope, options);
					}
				} else {
					options = attrs;
				}

				item.init($el, gridster);

				$el.addClass('gridster-item');
				$el.addClass('gridster-item-moving');

				function setDraggable() {
					if (draggablePossible) {
						if (typeof gridster.options.draggable !== 'undefined' && gridster.options.draggable.enabled) {
							$el.draggable({
								handle: gridster.options.draggable && gridster.options.draggable.handle ? gridster.options.draggable.handle : null,
								refreshPositions: true,
								start: function(e, widget) {
									$el.addClass('gridster-item-moving');
									item.dragging = true;
									gridster.$preview.show();
									gridster.setElementSizeX(gridster.$preview, item.sizeX);
									gridster.setElementSizeY(gridster.$preview, item.sizeY);
									gridster.setElementPosition(gridster.$preview, item.row, item.col);
									gridster.updateHeight(item.sizeY);
									scope.$apply(function() {
										if (gridster.options.draggable && gridster.options.draggable.start) {
											gridster.options.draggable.start(e, widget, $el);
										}
									});
								},
								drag: function(e, widget) {
									item.row = gridster.pixelsToRows(widget.position.top);
									item.col = gridster.pixelsToColumns(widget.position.left);
									scope.$apply(function() {
										if (gridster.options.draggable && gridster.options.draggable.drag) {
											gridster.options.draggable.drag(e, widget, $el);
										}
									});
								},
								stop: function(e, widget) {
									$el.removeClass('gridster-item-moving');
									item.row = gridster.pixelsToRows(widget.position.top);
									item.col = gridster.pixelsToColumns(widget.position.left);
									item.dragging = false;
									gridster.$preview.hide();
									item.setPosition(item.row, item.col);
									gridster.updateHeight();
									scope.$apply(function() {
										if (gridster.options.draggable && gridster.options.draggable.stop) {
											gridster.options.draggable.stop(e, widget, $el);
										}
									});
								}
							});
						} else {
							try {
								$el.draggable('destroy');
							} catch (e) {}
						}
					}
				}

				function updateResizableDimensions(enabled) {
					if (resizablePossible && enabled) {
						$el.resizable('option', 'minHeight', gridster.options.minRows * gridster.options.curRowHeight - gridster.options.margins[0]);
						$el.resizable('option', 'maxHeight', gridster.options.maxRows * gridster.options.curRowHeight - gridster.options.margins[0]);
						$el.resizable('option', 'minWidth', gridster.options.minColumns * gridster.options.curColWidth - gridster.options.margins[1]);
						$el.resizable('option', 'maxWidth', gridster.options.columns * gridster.options.curColWidth - gridster.options.margins[1]);
					}
				}

				function setResizable() {
					if (resizablePossible) {
						if (typeof gridster.options.resizable !== 'undefined' && gridster.options.resizable.enabled) {
							$el.resizable({
								autoHide: true,
								handles: 'n, e, s, w, ne, se, sw, nw',
								minHeight: gridster.options.minRows * gridster.options.curRowHeight - gridster.options.margins[0],
								maxHeight: gridster.options.maxRows * gridster.options.curRowHeight - gridster.options.margins[0],
								minWidth: gridster.options.minColumns * gridster.options.curColWidth - gridster.options.margins[1],
								maxWidth: gridster.options.columns * gridster.options.curColWidth - gridster.options.margins[1],
								start: function(e, widget) {
									$el.addClass('gridster-item-moving');
									item.resizing = true;
									item.dragging = true;
									gridster.$preview.fadeIn(300);
									gridster.setElementSizeX(gridster.$preview, item.sizeX);
									gridster.setElementSizeY(gridster.$preview, item.sizeY);
									scope.$apply(function() {
										if (gridster.options.resizable && gridster.options.resizable.start) {
											gridster.options.resizable.start(e, widget, $el);
										}
									});
								},
								resize: function(e, widget) {
									item.row = gridster.pixelsToRows(widget.position.top, false);
									item.col = gridster.pixelsToColumns(widget.position.left, false);
									item.sizeX = gridster.pixelsToColumns(widget.size.width, true);
									item.sizeY = gridster.pixelsToRows(widget.size.height, true);
									scope.$apply(function() {
										if (gridster.options.resizable && gridster.options.resizable.resize) {
											gridster.options.resizable.resize(e, widget, $el);
										}
									});
								},
								stop: function(e, widget) {
									$el.removeClass('gridster-item-moving');
									item.row = gridster.pixelsToRows(widget.position.top, false);
									item.col = gridster.pixelsToColumns(widget.position.left, false);
									item.sizeX = gridster.pixelsToColumns(widget.size.width, true);
									item.sizeY = gridster.pixelsToRows(widget.size.height, true);
									item.resizing = false;
									item.dragging = false;
									gridster.$preview.fadeOut(300);
									item.setPosition(item.row, item.col);
									item.setSizeY(item.sizeY);
									item.setSizeX(item.sizeX);
									scope.$apply(function() {
										if (gridster.options.resizable && gridster.options.resizable.stop) {
											gridster.options.resizable.stop(e, widget, $el);
										}
									});
								}
							});
						} else {
							try {
								$el.resizable('destroy');
							} catch (e) {}
						}
					}
				}

				var aspects = ['sizeX', 'sizeY', 'row', 'col'],
					$getters = {};

				var aspectFn = function(aspect) {
					var key;
					if (typeof options[aspect] === 'string') {
						key = options[aspect];
					} else if (typeof options[aspect.toLowerCase()] === 'string') {
						key = options[aspect.toLowerCase()];
					} else if (optionsKey) {
						key = $parse(optionsKey + '.' + aspect);
					} else {
						return;
					}
					$getters[aspect] = $parse(key);
					scope.$watch(key, function(newVal) {
						newVal = parseInt(newVal, 10);
						if (!isNaN(newVal)) {
							item[aspect] = newVal;
						}
					});
					var val = $getters[aspect](scope);
					if (typeof val === 'number') {
						item[aspect] = val;
					}
				};

				for (var i = 0, l = aspects.length; i < l; ++i) {
					aspectFn(aspects[i]);
				}

				function positionChanged() {
					item.setPosition(item.row, item.col);
					if ($getters.row && $getters.row.assign) {
						$getters.row.assign(scope, item.row);
					}
					if ($getters.col && $getters.col.assign) {
						$getters.col.assign(scope, item.col);
					}
				}
				scope.$watch(function() {
					return item.row;
				}, positionChanged);
				scope.$watch(function() {
					return item.col;
				}, positionChanged);

				scope.$on('draggable-changed', setDraggable);

				scope.$on('resizable-changed', setResizable);

				scope.$on('gridster-resized', updateResizableDimensions);

				setDraggable();
				setResizable();

				scope.$watch(function() {
					return item.sizeY;
				}, function(sizeY) {
					item.setSizeY(sizeY);
					if ($getters.sizeY && $getters.sizeY.assign) {
						$getters.sizeY.assign(scope, item.sizeY);
					}
				});
				scope.$watch(function() {
					return item.sizeX;
				}, function(sizeX) {
					item.setSizeX(sizeX);
					if ($getters.sizeX && $getters.sizeX.assign) {
						$getters.sizeX.assign(scope, item.sizeX);
					}
				});

				$timeout(function() {
					$el.removeClass('gridster-item-moving');
				}, 100);

				return scope.$on('$destroy', function() {
					try {
						gridster.removeItem(item);
					} catch (e) {}
					try {
						item.destroy();
					} catch (e) {}
					try {
						$el.draggable('destroy');
					} catch (e) {}
					try {
						$el.resizable('destroy');
					} catch (e) {}
				});
			}
		};
	}
])

;
