let exportAPI;
(function () {
    const VERSION = '0.4.87';

    const utils = {
        getUniqueName (prefix) {
            const n = Utils.__uniqcount || 0;
            Utils.__uniqcount = n + 1;
            return (prefix || "__id_") + n;
        },

        isFunction (obj) {
            return typeof obj == 'function';
        },

        isObject (obj) {
            return obj === Object(obj); // via underscore
        },

        clamp (val, min, max) {
            return val < min ? min : (val > max ? max : val);
        },

        interpolate (val1, val2, pct) {
            return val1 * (1 - pct) + val2 * pct;
        },

        isArray (obj) {
            return Array.isArray(obj);
        },

        // NaN -> true
        isNumber (obj) {
            // return toString.call(obj) == '[object Number]'; // ie8 breaks?
            return obj != null && obj.constructor == Number;
        },

        isInteger (obj) {
            return Utils.isNumber(obj) && ((obj | 0) === obj);
        },

        isString (obj) {
            return obj != null && obj.toString === String.prototype.toString;
            // TODO: replace w/ something better.
        },

        isBoolean (obj) {
            return obj === true || obj === false;
        },

        // Convert an array-like object to an Array, or make a copy if @obj is an Array
        toArray (obj) {
            let arr;
            if (!Utils.isArrayLike(obj)) error("Utils.toArray() requires an array-like object");
            try {
                arr = Array.prototype.slice.call(obj, 0); // breaks in ie8
            } catch (e) {
                // support ie8
                arr = [];
                for (let i = 0, n = obj.length; i < n; i++) {
                    arr[i] = obj[i];
                }
            }
            return arr;
        },

        // Array like: has length property, is numerically indexed and mutable.
        // TODO: try to detect objects with length property but no indexed data elements
        isArrayLike (obj) {
            if (!obj) return false;
            if (Utils.isArray(obj)) return true;
            if (Utils.isString(obj)) return false;
            if (obj.length === 0) return true;
            if (obj.length > 0) return true;
            return false;
        },

        // See https://raw.github.com/kvz/phpjs/master/functions/strings/addslashes.js
        addslashes (str) {
            return (`${str}`).replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0'); // eslint-disable-line no-control-regex
        },

        // Escape a literal string to use in a regexp.
        // Ref.: http://simonwillison.net/2006/Jan/20/escape/
        regexEscape (str) {
            return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        },

        defaults (dest, ...args) {
            for (let i = 0, n = args.length; i < n; i++) {
                const src = args[i] || {};
                for (const key in src) {
                    if (key in dest === false && Object.prototype.hasOwnProperty.call(src, key)) {
                        dest[key] = src[key];
                    }
                }
            }
            return dest;
        },

        extend (o, ...args) {
            const dest = o || {},
                n = args.length;
            let key, i, src;
            for (i = 0; i < n; i++) {
                src = args[i] || {};
                for (key in src) {
                    if (Object.prototype.hasOwnProperty.call(src, key)) {
                        dest[key] = src[key];
                    }
                }
            }
            return dest;
        },

        // Pseudoclassical inheritance
        //
        // Inherit from a Parent function:
        //    Utils.inherit(Child, Parent);
        // Call parent's constructor (inside child constructor):
        //    this.__super__([args...]);
        inherit (targ, src) {
            const f = function (...args) {
                if (this.__super__ == f) {
                    // add __super__ of parent to front of lookup chain
                    // so parent class constructor can call its parent using this.__super__
                    this.__super__ = src.prototype.__super__;
                    // call parent constructor function. this.__super__ now points to parent-of-parent
                    src.apply(this, ...args);
                    // remove temp __super__, expose targ.prototype.__super__ again
                    delete this.__super__;
                }
            };

            f.prototype = src.prototype || src; // added || src to allow inheriting from objects as well as functions
            // Extend targ prototype instead of wiping it out --
            //   in case inherit() is called after targ.prototype = {stuff}; statement
            targ.prototype = Utils.extend(new f(), targ.prototype); //
            targ.prototype.constructor = targ;
            targ.prototype.__super__ = f;
        },

        // Inherit from a parent, call the parent's constructor, optionally extend
        // prototype with optional additional arguments
        subclass (parent, ...args) {
            const child = function () {
                this.__super__(parent, ...Utils.toArray(args));
            };
            Utils.inherit(child, parent);
            for (let i = 0; i < arguments.length; i++) {
                Utils.extend(child.prototype, args[i]);
            }
            return child;
        }

    };

    const Utils = utils;

// Append elements of @src array to @dest array
    utils.merge = function (dest, src) {
        if (!utils.isArray(dest) || !utils.isArray(src)) {
            error("Usage: utils.merge(destArray, srcArray);");
        }
        for (let i = 0, n = src.length; i < n; i++) {
            dest.push(src[i]);
        }
        return dest;
    };

// Returns elements in arr and not in other
// (similar to underscore diff)
    utils.difference = function (arr, other) {
        const index = utils.arrayToIndex(other);
        return arr.filter((el) => !Object.prototype.hasOwnProperty.call(index, el));
    };

// Test a string or array-like object for existence of substring or element
    utils.contains = function (container, item) {
        if (utils.isString(container)) {
            return container.indexOf(item) != -1;
        } else if (utils.isArrayLike(container)) {
            return utils.indexOf(container, item) != -1;
        }
        error("Expected Array or String argument");
    };

    utils.some = function (arr, test) {
        return arr.reduce((val, item) => 
             val || test(item) // TODO: short-circuit?
        , false);
    };

    utils.every = function (arr, test) {
        return arr.reduce((val, item) => val && test(item), true);
    };

    utils.find = function (arr, test, ctx) {
        const matches = arr.filter(test, ctx);
        return matches.length === 0 ? null : matches[0];
    };

    utils.indexOf = function (arr, item, prop) {
        if (prop) error("utils.indexOf() No longer supports property argument");
        const nan = item !== item;
        for (let i = 0, len = arr.length || 0; i < len; i++) {
            if (arr[i] === item) return i;
            if (nan && arr[i] !== arr[i]) return i;
        }
        return -1;
    };

    utils.range = function (len, start, inc) {
        const arr = [];
        let v = start === void 0 ? 0 : start;
        const i = inc === void 0 ? 1 : inc;
        while (len--) {
            arr.push(v);
            v += i;
        }
        return arr;
    };

    utils.repeat = function (times, func) {
        const values = [];
        let val;
        for (let i = 0; i < times; i++) {
            val = func(i);
            if (val !== void 0) {
                values[i] = val;
            }
        }
        return values.length > 0 ? values : void 0;
    };

// Calc sum, skip falsy and NaN values
// Assumes: no other non-numeric objects in array
//
    utils.sum = function (arr, info) {
        if (!utils.isArrayLike(arr)) error("utils.sum() expects an array, received:", arr);
        let tot = 0,
            nan = 0,
            val;
        for (let i = 0, n = arr.length; i < n; i++) {
            val = arr[i];
            if (val) {
                tot += val;
            } else if (isNaN(val)) {
                nan++;
            }
        }
        if (info) {
            info.nan = nan;
        }
        return tot;
    };

// Calculate min and max values of an array, ignoring NaN values
    utils.getArrayBounds = function (arr) {
        let min = Infinity,
            max = -Infinity,
            nan = 0, val;
        for (let i = 0, len = arr.length; i < len; i++) {
            val = arr[i];
            if (val !== val) nan++;
            if (val < min) min = val;
            if (val > max) max = val;
        }
        return {
            min,
            max,
            nan
        };
    };

    utils.uniq = function (src) {
        const index = {};
        return src.reduce((memo, el) => {
            if (el in index === false) {
                index[el] = true;
                memo.push(el);
            }
            return memo;
        }, []);
    };

    utils.pluck = function (arr, key) {
        return arr.map((obj) => obj[key]);
    };

    utils.countValues = function (arr) {
        return arr.reduce((memo, val) => {
            memo[val] = (val in memo) ? memo[val] + 1 : 1;
            return memo;
        }, {});
    };

    utils.indexOn = function (arr, k) {
        return arr.reduce((index, o) => {
            index[o[k]] = o;
            return index;
        }, {});
    };

    utils.groupBy = function (arr, k) {
        return arr.reduce((index, o) => {
            const keyval = o[k];
            if (keyval in index) {
                index[keyval].push(o);
            } else {
                index[keyval] = [o];
            }
            return index;
        }, {});
    };

    utils.arrayToIndex = function (arr, val) {
        const init = arguments.length > 1;
        return arr.reduce((index, key) => {
            index[key] = init ? val : true;
            return index;
        }, {});
    };

// Support for iterating over array-like objects, like typed arrays
    utils.forEach = function (arr, func, ctx) {
        if (!utils.isArrayLike(arr)) {
            throw new Error(`#forEach() takes an array-like argument. ${arr}`);
        }
        for (let i = 0, n = arr.length; i < n; i++) {
            func.call(ctx, arr[i], i);
        }
    };

    utils.forEachProperty = function (o, func, ctx) {
        Object.keys(o).forEach((key) => {
            func.call(ctx, o[key], key);
        });
    };

    utils.initializeArray = function (arr, init) {
        for (let i = 0, len = arr.length; i < len; i++) {
            arr[i] = init;
        }
        return arr;
    };

    utils.replaceArray = function (arr, arr2) {
        arr.splice(0, arr.length);
        for (let i = 0, n = arr2.length; i < n; i++) {
            arr.push(arr2[i]);
        }
    };


    Utils.repeatString = function (src, n) {
        let str = "";
        for (let i = 0; i < n; i++)
            str += src;
        return str;
    };

    Utils.pluralSuffix = function (count) {
        return count != 1 ? 's' : '';
    };

    Utils.endsWith = function (str, ending) {
        return str.indexOf(ending, str.length - ending.length) !== -1;
    };

    Utils.lpad = function (str, size, pad) {
        pad = pad || ' ';
        str = String(str);
        return Utils.repeatString(pad, size - str.length) + str;
    };

    Utils.rpad = function (str, size, pad) {
        pad = pad || ' ';
        str = String(str);
        return str + Utils.repeatString(pad, size - str.length);
    };

    Utils.trim = function (str) {
        return Utils.ltrim(Utils.rtrim(str));
    };

    const ltrimRxp = /^\s+/;
    Utils.ltrim = function (str) {
        return str.replace(ltrimRxp, '');
    };

    const rtrimRxp = /\s+$/;
    Utils.rtrim = function (str) {
        return str.replace(rtrimRxp, '');
    };

    Utils.addThousandsSep = function (str) {
        let fmt = '';
        const start = str[0] == '-' ? 1 : 0;
        const dec = str.indexOf('.');
        let end = str.length,
            ins = (dec == -1 ? end : dec) - 3;
        while (ins > start) {
            fmt = `,${str.substring(ins, end)}${fmt}`;
            end = ins;
            ins -= 3;
        }
        return str.substring(0, end) + fmt;
    };

    Utils.numToStr = function (num, decimals) {
        return decimals >= 0 ? num.toFixed(decimals) : String(num);
    };

    Utils.formatNumber = function (num, decimals, nullStr, showPos) {
        let fmt;
        if (isNaN(num)) {
            fmt = nullStr || '-';
        } else {
            fmt = Utils.numToStr(num, decimals);
            fmt = Utils.addThousandsSep(fmt);
            if (showPos && parseFloat(fmt) > 0) {
                fmt = `+${fmt}`;
            }
        }
        return fmt;
    };


    function Transform() {
        this.mx = this.my = 1;
        this.bx = this.by = 0;
    }

    Transform.prototype.isNull = function () {
        return !this.mx || !this.my || isNaN(this.bx) || isNaN(this.by);
    };

    Transform.prototype.invert = function () {
        const inv = new Transform();
        inv.mx = 1 / this.mx;
        inv.my = 1 / this.my;
        //inv.bx = -this.bx * inv.mx;
        //inv.by = -this.by * inv.my;
        inv.bx = -this.bx / this.mx;
        inv.by = -this.by / this.my;
        return inv;
    };


    Transform.prototype.transform = function (x, y, xy) {
        xy = xy || [];
        xy[0] = x * this.mx + this.bx;
        xy[1] = y * this.my + this.by;
        return xy;
    };

    Transform.prototype.toString = function () {
        return JSON.stringify(Utils.extend({}, this));
    };


    function Bounds(...args) {
        if (args.length > 0) {
            this.setBounds(...args);
        }
    }

    Bounds.prototype.toString = function () {
        return JSON.stringify({
            xmin: this.xmin,
            xmax: this.xmax,
            ymin: this.ymin,
            ymax: this.ymax
        });
    };

    Bounds.prototype.toArray = function () {
        return this.hasBounds() ? [this.xmin, this.ymin, this.xmax, this.ymax] : [];
    };

    Bounds.prototype.hasBounds = function () {
        return this.xmin <= this.xmax && this.ymin <= this.ymax;
    };

    Bounds.prototype.sameBounds =
        Bounds.prototype.equals = function (bb) {
            return bb && this.xmin === bb.xmin && this.xmax === bb.xmax &&
                this.ymin === bb.ymin && this.ymax === bb.ymax;
        };

    Bounds.prototype.width = function () {
        return (this.xmax - this.xmin) || 0;
    };

    Bounds.prototype.height = function () {
        return (this.ymax - this.ymin) || 0;
    };

    Bounds.prototype.area = function () {
        return this.width() * this.height() || 0;
    };

    Bounds.prototype.empty = function () {
        this.xmin = this.ymin = this.xmax = this.ymax = void 0;
        return this;
    };

    Bounds.prototype.setBounds = function (a, b, c, d) {
        if (arguments.length == 1) {
            // assume first arg is a Bounds or array
            if (Utils.isArrayLike(a)) {
                b = a[1];
                c = a[2];
                d = a[3];
                a = a[0];
            } else {
                b = a.ymin;
                c = a.xmax;
                d = a.ymax;
                a = a.xmin;
            }
        }

        this.xmin = a;
        this.ymin = b;
        this.xmax = c;
        this.ymax = d;
        if (a > c || b > d) this.update();
        // error("Bounds#setBounds() min/max reversed:", a, b, c, d);
        return this;
    };


    Bounds.prototype.centerX = function () {
        const x = (this.xmin + this.xmax) * 0.5;
        return x;
    };

    Bounds.prototype.centerY = function () {
        const y = (this.ymax + this.ymin) * 0.5;
        return y;
    };

    Bounds.prototype.containsPoint = function (x, y) {
        if (x >= this.xmin && x <= this.xmax &&
            y <= this.ymax && y >= this.ymin) {
            return true;
        }
        return false;
    };

// intended to speed up slightly bubble symbol detection; could use intersects() instead
// TODO: fix false positive where circle is just outside a corner of the box
    Bounds.prototype.containsBufferedPoint =
        Bounds.prototype.containsCircle = function (x, y, buf) {
            if (x + buf > this.xmin && x - buf < this.xmax) {
                if (y - buf < this.ymax && y + buf > this.ymin) {
                    return true;
                }
            }
            return false;
        };

    Bounds.prototype.intersects = function (bb) {
        if (bb.xmin <= this.xmax && bb.xmax >= this.xmin &&
            bb.ymax >= this.ymin && bb.ymin <= this.ymax) {
            return true;
        }
        return false;
    };

    Bounds.prototype.contains = function (bb) {
        if (bb.xmin >= this.xmin && bb.ymax <= this.ymax &&
            bb.xmax <= this.xmax && bb.ymin >= this.ymin) {
            return true;
        }
        return false;
    };

    Bounds.prototype.shift = function (x, y) {
        this.setBounds(this.xmin + x,
            this.ymin + y, this.xmax + x, this.ymax + y);
    };

    Bounds.prototype.padBounds = function (a, b, c, d) {
        this.xmin -= a;
        this.ymin -= b;
        this.xmax += c;
        this.ymax += d;
    };

// Rescale the bounding box by a fraction. TODO: implement focus.
// @param {number} pct Fraction of original extents
// @param {number} pctY Optional amount to scale Y
//
    Bounds.prototype.scale = function (pct, pctY) { /*, focusX, focusY*/
        const halfWidth = (this.xmax - this.xmin) * 0.5;
        const halfHeight = (this.ymax - this.ymin) * 0.5;
        const kx = pct - 1;
        const ky = pctY === undefined ? kx : pctY - 1;
        this.xmin -= halfWidth * kx;
        this.ymin -= halfHeight * ky;
        this.xmax += halfWidth * kx;
        this.ymax += halfHeight * ky;
    };

// Return a bounding box with the same extent as this one.
    Bounds.prototype.cloneBounds = // alias so child classes can override clone()
        Bounds.prototype.clone = function () {
            return new Bounds(this.xmin, this.ymin, this.xmax, this.ymax);
        };

    Bounds.prototype.clearBounds = function () {
        this.setBounds(new Bounds());
    };

    Bounds.prototype.mergePoint = function (x, y) {
        if (this.xmin === void 0) {
            this.setBounds(x, y, x, y);
        } else {
            // this works even if x,y are NaN
            if (x < this.xmin) this.xmin = x;
            else if (x > this.xmax) this.xmax = x;

            if (y < this.ymin) this.ymin = y;
            else if (y > this.ymax) this.ymax = y;
        }
    };

// expands either x or y dimension to match @aspect (width/height ratio)
// @focusX, @focusY (optional): expansion focus, as a fraction of width and height
    Bounds.prototype.fillOut = function (aspect, focusX, focusY) {
        if (arguments.length < 3) {
            focusX = 0.5;
            focusY = 0.5;
        }
        const w = this.width(),
            h = this.height(),
            currAspect = w / h;
        let pad;
        if (isNaN(aspect) || aspect <= 0) {
            // error condition; don't pad
        } else if (currAspect < aspect) { // fill out x dimension
            pad = h * aspect - w;
            this.xmin -= (1 - focusX) * pad;
            this.xmax += focusX * pad;
        } else {
            pad = w / aspect - h;
            this.ymin -= (1 - focusY) * pad;
            this.ymax += focusY * pad;
        }
        return this;
    };

    Bounds.prototype.update = function () {
        let tmp;
        if (this.xmin > this.xmax) {
            tmp = this.xmin;
            this.xmin = this.xmax;
            this.xmax = tmp;
        }
        if (this.ymin > this.ymax) {
            tmp = this.ymin;
            this.ymin = this.ymax;
            this.ymax = tmp;
        }
    };

    Bounds.prototype.transform = function (t) {
        this.xmin = this.xmin * t.mx + t.bx;
        this.xmax = this.xmax * t.mx + t.bx;
        this.ymin = this.ymin * t.my + t.by;
        this.ymax = this.ymax * t.my + t.by;
        this.update();
        return this;
    };

// Returns a Transform object for mapping this onto Bounds @b2
// @flipY (optional) Flip y-axis coords, for converting to/from pixel coords
//
    Bounds.prototype.getTransform = function (b2, flipY) {
        const t = new Transform();
        t.mx = b2.width() / this.width() || 1; // TODO: better handling of 0 w,h
        t.bx = b2.xmin - t.mx * this.xmin;
        if (flipY) {
            t.my = -b2.height() / this.height() || 1;
            t.by = b2.ymax - t.my * this.ymin;
        } else {
            t.my = b2.height() / this.height() || 1;
            t.by = b2.ymin - t.my * this.ymin;
        }
        return t;
    };

    Bounds.prototype.mergeCircle = function (x, y, r) {
        if (r < 0) r = -r;
        this.mergeBounds([x - r, y - r, x + r, y + r]);
    };

    Bounds.prototype.mergeBounds = function (bb, ...args) {
        let a, b, c, d;
        if (bb instanceof Bounds) {
            a = bb.xmin;
            b = bb.ymin;
            c = bb.xmax;
            d = bb.ymax;
        } else if (args.length == 3) {
            a = bb;
            b = args[0];
            c = args[1];
            d = args[2];
        } else if (bb.length == 4) {
            // assume array: [xmin, ymin, xmax, ymax]
            a = bb[0];
            b = bb[1];
            c = bb[2];
            d = bb[3];
        } else {
            error("Bounds#mergeBounds() invalid argument:", bb);
        }

        if (this.xmin === void 0) {
            this.setBounds(a, b, c, d);
        } else {
            if (a < this.xmin) this.xmin = a;
            if (b < this.ymin) this.ymin = b;
            if (c > this.xmax) this.xmax = c;
            if (d > this.ymax) this.ymax = d;
        }
        return this;
    };


// Sort an array of objects based on one or more properties.
// Usage: Utils.sortOn(array, key1, asc?[, key2, asc? ...])
//
    Utils.sortOn = function (arr, ...args) {
        const comparators = [];
        for (let i = 0; i < arguments.length; i += 2) {
            comparators.push(Utils.getKeyComparator(args[i], args[i + 1]));
        }
        arr.sort((a, b) => {
            let cmp = 0,
                i = 0;
            const n = comparators.length;
            while (i < n && cmp === 0) {
                cmp = comparators[i](a, b);
                i++;
            }
            return cmp;
        });
        return arr;
    };

// Sort array of values that can be compared with < > operators (strings, numbers)
// null, undefined and NaN are sorted to the end of the array
//
    Utils.genericSort = function (arr, asc) {
        const compare = Utils.getGenericComparator(asc);
        Array.prototype.sort.call(arr, compare);
        return arr;
    };

    Utils.sortOnKey = function (arr, getter, asc) {
        const compare = Utils.getGenericComparator(asc !== false); // asc is default
        arr.sort((a, b) => compare(getter(a), getter(b)));
    };

// Stashes keys in a temp array (better if calculating key is expensive).
    Utils.sortOnKey2 = function (arr, getKey, asc) {
        Utils.sortArrayByKeys(arr, arr.map(getKey), asc);
    };

    Utils.sortArrayByKeys = function (arr, keys, asc) {
        const ids = Utils.getSortedIds(keys, asc);
        Utils.reorderArray(arr, ids);
    };

    Utils.getSortedIds = function (arr, asc) {
        const ids = Utils.range(arr.length);
        Utils.sortArrayIndex(ids, arr, asc);
        return ids;
    };

    Utils.sortArrayIndex = function (ids, arr, asc) {
        const compare = Utils.getGenericComparator(asc);
        ids.sort((i, j) => {
            // added i, j comparison to guarantee that sort is stable
            const cmp = compare(arr[i], arr[j]);
            return cmp > 0 || cmp === 0 && i > j ? 1 : -1;
        });
    };

    Utils.reorderArray = function (arr, idxs) {
        const len = idxs.length;
        const arr2 = [];
        for (let i = 0; i < len; i++) {
            const idx = idxs[i];
            if (idx < 0 || idx >= len) error("Out-of-bounds array idx");
            arr2[i] = arr[idx];
        }
        Utils.replaceArray(arr, arr2);
    };

    Utils.getKeyComparator = function (key, asc) {
        const compare = Utils.getGenericComparator(asc);
        return function (a, b) {
            return compare(a[key], b[key]);
        };
    };

    Utils.getGenericComparator = function (asc) {
        asc = asc !== false;
        return function (a, b) {
            let retn = 0;
            if (b == null) {
                retn = a == null ? 0 : -1;
            } else if (a == null) {
                retn = 1;
            } else if (a < b) {
                retn = asc ? -1 : 1;
            } else if (a > b) {
                retn = asc ? 1 : -1;
            } else if (a !== a) {
                retn = 1;
            } else if (b !== b) {
                retn = -1;
            }
            return retn;
        };
    };


// Generic in-place sort (null, NaN, undefined not handled)
    Utils.quicksort = function (arr, asc) {
        Utils.quicksortPartition(arr, 0, arr.length - 1);
        if (asc === false) Array.prototype.reverse.call(arr); // Works with typed arrays
        return arr;
    };

// Moved out of Utils.quicksort() (saw >100% speedup in Chrome with deep recursion)
    Utils.quicksortPartition = function (a, lo, hi) {
        let i = lo,
            j = hi,
            pivot, tmp;
        while (i < hi) {
            pivot = a[lo + hi >> 1]; // avoid n^2 performance on sorted arrays
            while (i <= j) {
                while (a[i] < pivot) i++;
                while (a[j] > pivot) j--;
                if (i <= j) {
                    tmp = a[i];
                    a[i] = a[j];
                    a[j] = tmp;
                    i++;
                    j--;
                }
            }
            if (lo < j) Utils.quicksortPartition(a, lo, j);
            lo = i;
            j = hi;
        }
    };


    Utils.findRankByValue = function (arr, value) {
        if (isNaN(value)) return arr.length;
        let rank = 1;
        for (let i = 0, n = arr.length; i < n; i++) {
            if (value > arr[i]) rank++;
        }
        return rank;
    };

    Utils.findValueByPct = function (arr, pct) {
        const rank = Math.ceil((1 - pct) * (arr.length));
        return Utils.findValueByRank(arr, rank);
    };

// See http://ndevilla.free.fr/median/median/src/wirth.c
// Elements of @arr are reordered
//
    Utils.findValueByRank = function (arr, rank) {
        if (!arr.length || rank < 1 || rank > arr.length) error("[findValueByRank()] invalid input");

        rank = Utils.clamp(rank | 0, 1, arr.length);
        const k = rank - 1, // conv. rank to array index
            n = arr.length;
        let l = 0,
            m = n - 1,
            i, j, val, tmp;

        while (l < m) {
            val = arr[k];
            i = l;
            j = m;
            do {
                while (arr[i] < val) {
                    i++;
                }
                while (val < arr[j]) {
                    j--;
                }
                if (i <= j) {
                    tmp = arr[i];
                    arr[i] = arr[j];
                    arr[j] = tmp;
                    i++;
                    j--;
                }
            } while (i <= j);
            if (j < k) l = i;
            if (k < i) m = j;
        }
        return arr[k];
    };

//
//
    Utils.findMedian = function (arr) {
        const n = arr.length,
            rank = Math.floor(n / 2) + 1;
        let median = Utils.findValueByRank(arr, rank);
        if ((n & 1) == 0) {
            median = (median + Utils.findValueByRank(arr, rank - 1)) / 2;
        }
        return median;
    };


    Utils.mean = function (arr) {
        let count = 0,
            avg = NaN,
            val;
        for (let i = 0, n = arr.length; i < n; i++) {
            val = arr[i];
            if (isNaN(val)) continue;
            avg = ++count == 1 ? val : val / count + (count - 1) / count * avg;
        }
        return avg;
    };


// Wrapper for DataView class for more convenient reading and writing of
//   binary data; Remembers endianness and read/write position.
// Has convenience methods for copying from buffers, etc.
//
    function BinArray(buf, le) {
        if (Utils.isNumber(buf)) {
            buf = new ArrayBuffer(buf);
        } else if (typeof Buffer == 'function' && buf instanceof Buffer) { // eslint-disable-line no-undef
            // Since node 0.10, DataView constructor doesn't accept Buffers,
            //   so need to copy Buffer to ArrayBuffer
            buf = BinArray.toArrayBuffer(buf);
        }
        if (buf instanceof ArrayBuffer == false) {
            error("BinArray constructor takes an integer, ArrayBuffer or Buffer argument");
        }
        this._buffer = buf;
        this._bytes = new Uint8Array(buf);
        this._view = new DataView(buf);
        this._idx = 0;
        this._le = le !== false;
    }

    BinArray.bufferToUintArray = function (buf, wordLen) {
        if (wordLen == 4) return new Uint32Array(buf);
        if (wordLen == 2) return new Uint16Array(buf);
        if (wordLen == 1) return new Uint8Array(buf);
        error("BinArray.bufferToUintArray() invalid word length:", wordLen);
    };

    BinArray.uintSize = function (i) {
        return i & 1 || i & 2 || 4;
    };

    BinArray.bufferCopy = function (dest, destId, src, srcId, bytes) {
        srcId = srcId || 0;
        bytes = bytes || src.byteLength - srcId;
        if (dest.byteLength - destId < bytes)
            error("Buffer overflow; tried to write:", bytes);

        // When possible, copy buffer data in multi-byte chunks... Added this for faster copying of
        // shapefile data, which is aligned to 32 bits.
        const wordSize = Math.min(BinArray.uintSize(bytes), BinArray.uintSize(srcId),
            BinArray.uintSize(dest.byteLength), BinArray.uintSize(destId),
            BinArray.uintSize(src.byteLength));

        const srcArr = BinArray.bufferToUintArray(src, wordSize),
            destArr = BinArray.bufferToUintArray(dest, wordSize);
        let count = bytes / wordSize,
            i = srcId / wordSize,
            j = destId / wordSize;

        while (count--) {
            destArr[j++] = srcArr[i++];
        }
        return bytes;
    };

    BinArray.toArrayBuffer = function (src) {
        const n = src.length,
            dest = new ArrayBuffer(n),
            view = new Uint8Array(dest);
        for (let i = 0; i < n; i++) {
            view[i] = src[i];
        }
        return dest;
    };

// Return length in bytes of an ArrayBuffer or Buffer
//
    BinArray.bufferSize = function (buf) {
        return (buf instanceof ArrayBuffer ? buf.byteLength : buf.length | 0);
    };

    Utils.buffersAreIdentical = function (a, b) {
        const alen = BinArray.bufferSize(a);
        const blen = BinArray.bufferSize(b);
        if (alen != blen) {
            return false;
        }
        for (let i = 0; i < alen; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    };

    BinArray.prototype = {
        size () {
            return this._buffer.byteLength;
        },

        littleEndian () {
            this._le = true;
            return this;
        },

        bigEndian () {
            this._le = false;
            return this;
        },

        buffer () {
            return this._buffer;
        },

        bytesLeft () {
            return this._buffer.byteLength - this._idx;
        },

        skipBytes (bytes) {
            this._idx += (bytes + 0);
            return this;
        },

        readUint8 () {
            return this._bytes[this._idx++];
        },

        writeUint8 (val) {
            this._bytes[this._idx++] = val;
            return this;
        },

        readInt8 () {
            return this._view.getInt8(this._idx++);
        },

        writeInt8 (val) {
            this._view.setInt8(this._idx++, val);
            return this;
        },

        readUint16 () {
            const val = this._view.getUint16(this._idx, this._le);
            this._idx += 2;
            return val;
        },

        writeUint16 (val) {
            this._view.setUint16(this._idx, val, this._le);
            this._idx += 2;
            return this;
        },

        readUint32 () {
            const val = this._view.getUint32(this._idx, this._le);
            this._idx += 4;
            return val;
        },

        writeUint32 (val) {
            this._view.setUint32(this._idx, val, this._le);
            this._idx += 4;
            return this;
        },

        readInt32 () {
            const val = this._view.getInt32(this._idx, this._le);
            this._idx += 4;
            return val;
        },

        writeInt32 (val) {
            this._view.setInt32(this._idx, val, this._le);
            this._idx += 4;
            return this;
        },

        readFloat64 () {
            const val = this._view.getFloat64(this._idx, this._le);
            this._idx += 8;
            return val;
        },

        writeFloat64 (val) {
            this._view.setFloat64(this._idx, val, this._le);
            this._idx += 8;
            return this;
        },

        // Returns a Float64Array containing @len doubles
        //
        readFloat64Array (len) {
            const bytes = len * 8,
                i = this._idx,
                buf = this._buffer;
            let arr;
            // Inconsistent: first is a view, second a copy...
            if (i % 8 === 0) {
                arr = new Float64Array(buf, i, len);
            } else if (buf.slice) {
                arr = new Float64Array(buf.slice(i, i + bytes));
            } else { // ie10, etc
                const dest = new ArrayBuffer(bytes);
                BinArray.bufferCopy(dest, 0, buf, i, bytes);
                arr = new Float64Array(dest);
            }
            this._idx += bytes;
            return arr;
        },

        readUint32Array (len) {
            const arr = [];
            for (let i = 0; i < len; i++) {
                arr.push(this.readUint32());
            }
            return arr;
        },

        peek (i) {
            return this._view.getUint8(i >= 0 ? i : this._idx);
        },

        position (i) {
            if (i != null) {
                this._idx = i;
                return this;
            }
            return this._idx;
        },

        readCString (fixedLen, asciiOnly) {
            let str = "",
                count = fixedLen >= 0 ? fixedLen : this.bytesLeft();
            while (count > 0) {
                const byteVal = this.readUint8();
                count--;
                if (byteVal == 0) {
                    break;
                } else if (byteVal > 127 && asciiOnly) {
                    str = null;
                    break;
                }
                str += String.fromCharCode(byteVal);
            }

            if (fixedLen > 0 && count > 0) {
                this.skipBytes(count);
            }
            return str;
        },

        writeString (str, maxLen) {
            let bytesWritten = 0,
                charsToWrite = str.length,
                cval;
            if (maxLen) {
                charsToWrite = Math.min(charsToWrite, maxLen);
            }
            for (let i = 0; i < charsToWrite; i++) {
                cval = str.charCodeAt(i);
                if (cval > 127) {
                    error("#writeCString() Unicode value beyond ascii range");
                    cval = '?'.charCodeAt(0);
                }
                this.writeUint8(cval);
                bytesWritten++;
            }
            return bytesWritten;
        },

        writeCString (str, fixedLen) {
            const maxChars = fixedLen ? fixedLen - 1 : null;
            let bytesWritten = this.writeString(str, maxChars);

            this.writeUint8(0); // terminator
            bytesWritten++;

            if (fixedLen) {
                while (bytesWritten < fixedLen) {
                    this.writeUint8(0);
                    bytesWritten++;
                }
            }
            return this;
        },

        writeBuffer (buf, bytes, startIdx) {
            this._idx += BinArray.bufferCopy(this._buffer, this._idx, buf, startIdx, bytes);
            return this;
        }
    };


    /*
A simplified version of printf formatting
Format codes: %[flags][width][.precision]type

supported flags:
  +   add '+' before positive numbers
  0   left-pad with '0'
  '   Add thousands separator
width: 1 to many
precision: .(1 to many)
type:
  s     string
  di    integers
  f     decimal numbers
  xX    hexidecimal (unsigned)
  %     literal '%'

Examples:
  code    val    formatted
  %+d     1      '+1'
  %4i     32     '  32'
  %04i    32     '0032'
  %x      255    'ff'
  %.2f    0.125  '0.13'
  %'f     1000   '1,000'
*/

// Usage: Utils.format(formatString, [values])
// Tip: When reusing the same format many times, use Utils.formatter() for 5x - 10x better performance
//
    Utils.format = function (fmt, ...args) {
        const fn = Utils.formatter(fmt);
        const str = fn(...args);
        return str;
    };

    function formatValue(val, matches) {
        const flags = matches[1];
        const padding = matches[2];
        const decimals = matches[3] ? parseInt(matches[3].substr(1)) : void 0;
        const type = matches[4];
        const isString = type == 's',
            isHex = type == 'x' || type == 'X',
            isInt = type == 'd' || type == 'i',
            // isFloat = type == 'f',
            isNumber = !isString;

        let sign = "",
            padDigits = 0,
            isZero = false,
            isNeg = false;

        let str, padChar, padStr;
        if (isString) {
            str = String(val);
        } else if (isHex) {
            str = val.toString(16);
            if (type == 'X')
                str = str.toUpperCase();
        } else if (isNumber) {
            str = Utils.numToStr(val, isInt ? 0 : decimals);
            if (str[0] == '-') {
                isNeg = true;
                str = str.substr(1);
            }
            isZero = parseFloat(str) == 0;
            if (flags.indexOf("'") != -1 || flags.indexOf(',') != -1) {
                str = Utils.addThousandsSep(str);
            }
            if (!isZero) { // BUG: sign is added when num rounds to 0
                if (isNeg) {
                    sign = "\u2212"; // U+2212
                } else if (flags.indexOf('+') != -1) {
                    sign = '+';
                }
            }
        }

        if (padding) {
            const strLen = str.length + sign.length;
            const minWidth = parseInt(padding, 10);
            if (strLen < minWidth) {
                padDigits = minWidth - strLen;
                padChar = flags.indexOf('0') == -1 ? ' ' : '0';
                padStr = Utils.repeatString(padChar, padDigits);
            }
        }

        if (padDigits == 0) {
            str = sign + str;
        } else if (padChar == '0') {
            str = sign + padStr + str;
        } else {
            str = padStr + sign + str;
        }
        return str;
    }

// Get a function for interpolating formatted values into a string.
    Utils.formatter = function (fmt) {
        const codeRxp = /%([',+0]*)([1-9]?)((?:\.[1-9])?)([sdifxX%])/g;
        const literals = [],
            formatCodes = [];
        let startIdx = 0,
            prefix = "",
            matches = codeRxp.exec(fmt),
            literal;

        while (matches) {
            literal = fmt.substring(startIdx, codeRxp.lastIndex - matches[0].length);
            if (matches[0] == '%%') {
                prefix += `${literal}%`;
            } else {
                literals.push(prefix + literal);
                prefix = '';
                formatCodes.push(matches);
            }
            startIdx = codeRxp.lastIndex;
            matches = codeRxp.exec(fmt);
        }
        literals.push(prefix + fmt.substr(startIdx));

        return function (...args) {
            let str = literals[0];
            const n = args.length;
            if (n != formatCodes.length) {
                error("[format()] Data does not match format string; format:", fmt, "data:", args);
            }
            for (let i = 0; i < n; i++) {
                str += formatValue(args[i], formatCodes[i]) + literals[i + 1];
            }
            return str;
        };
    };


    utils.wildcardToRegExp = function (name) {
        const rxp = name.split('*').map((str) => utils.regexEscape(str)).join('.*');
        return new RegExp(`^${rxp}$`);
    };

    utils.expandoBuffer = function (constructor, rate) {
        let capacity = 0;
        const k = rate >= 1 ? rate : 1.2;
        let buf;
        return function (size) {
            if (size > capacity) {
                capacity = Math.ceil(size * k);
                buf = new constructor(capacity);
            }
            return buf;
        };
    };

    utils.copyElements = function (src, i, dest, j, n, rev) {
        if (src === dest && j > i) error("copy error");
        let inc = 1,
            offs = 0;
        if (rev) {
            inc = -1;
            offs = n - 1;
        }
        for (let k = 0; k < n; k++, offs += inc) {
            dest[k + j] = src[i + offs];
        }
    };

    utils.extendBuffer = function (src, newLen, copyLen) {
        const len = Math.max(src.length, newLen);
        const n = copyLen || src.length;
        const dest = new src.constructor(len);
        utils.copyElements(src, 0, dest, 0, n);
        return dest;
    };

    utils.mergeNames = function (name1, name2) {
        let merged;
        if (name1 && name2) {
            merged = utils.findStringPrefix(name1, name2).replace(/[-_]$/, '');
        }
        return merged || '';
    };

    utils.findStringPrefix = function (a, b) {
        let i = 0;
        for (let n = a.length; i < n; i++) {
            if (a[i] !== b[i]) break;
        }
        return a.substr(0, i);
    };

// Similar to isFinite() but does not convert strings or other types
    utils.isFiniteNumber = function (val) {
        return val === 0 || !!val && val.constructor == Number && val !== Infinity && val !== -Infinity;
    };

    utils.isNonNegNumber = function (val) {
        return val === 0 || val > 0 && val.constructor == Number;
    };

    utils.parsePercent = function (o) {
        const str = String(o);
        const isPct = str.indexOf('%') > 0;
        let pct;
        if (isPct) {
            pct = Number(str.replace('%', '')) / 100;
        } else {
            pct = Number(str);
        }
        if (!(pct >= 0 && pct <= 1)) {
            stop(utils.format("Invalid percentage: %s", str));
        }
        return pct;
    };


    /*, mapshaper-buffer */

    const api = {};
    const internal = {
        VERSION, // export version
        LOGGING: false,
        context: createContext()
    };

// Support for timing using T.start() and T.stop("message")
    const T = {
        stack: [],
        start () {
            T.stack.push(+new Date());
        },
        stop (note) {
            const elapsed = (+new Date() - T.stack.pop());
            let msg = `${elapsed}ms`;
            if (note) {
                msg = `${note} ${msg}`;
            }
            verbose(msg);
            return elapsed;
        }
    };

    new Float64Array(1); // workaround for https://github.com/nodejs/node/issues/6006

    internal.runningInBrowser = function () {
        return !!api.gui;
    };

    internal.getStateVar = function (key) {
        return internal.context[key];
    };

    internal.setStateVar = function (key, val) {
        internal.context[key] = val;
    };

    function createContext() {
        return {
            DEBUG: false,
            QUIET: false,
            VERBOSE: false,
            defs: {},
            input_files: []
        };
    }

    function error(...args) {
        internal.error.apply(null, args);
    }

// Handle an error caused by invalid input or misuse of API
    function stop(...args) {
        internal.stop.apply(null, args);
    }

    function UserError(msg) {
        const err = new Error(msg);
        err.name = 'UserError';
        return err;
    }

    function messageArgs(args) {
        const arr = utils.toArray(args);
        const cmd = internal.getStateVar('current_command');
        if (cmd && cmd != 'help') {
            arr.unshift(`[${cmd}]`);
        }
        return arr;
    }

    function verbose(...args) {
        if (internal.getStateVar('VERBOSE')) {
            // internal.logArgs(arguments);
            internal.message.apply(null, messageArgs(args));
        }
    }

    function debug(...args) {
        if (internal.getStateVar('DEBUG')) {
            internal.logArgs(args);
        }
    }

    function absArcId(arcId) {
        return arcId >= 0 ? arcId : ~arcId;
    }

    api.enableLogging = function () {
        internal.LOGGING = true;
        return api;
    };

    api.printError = function (err) {
        let msg;
        if (utils.isString(err)) {
            err = new UserError(err);
        }
        if (internal.LOGGING && err.name == 'UserError') {
            msg = err.message;
            if (!/Error/.test(msg)) {
                msg = `Error: ${msg}`;
            }
            console.error(messageArgs([msg]).join(' ')); // eslint-disable-line no-undef
            internal.message("Run mapshaper -h to view help");
        } else {
            // not a user error or logging is disabled -- throw it
            throw err;
        }
    };

    internal.error = function (...args) {
        const msg = args.join(' ');
        throw new Error(msg);
    };

    internal.stop = function (...args) {
        throw new UserError(internal.formatLogArgs(args));
    };

    internal.message = function (...args) {
        internal.logArgs(args);
    };

    internal.formatLogArgs = function (args) {
        return args.join(' ');
    };

// Format an array of (preferably short) strings in columns for console logging.
    internal.formatStringsAsGrid = function (arr) {
        // TODO: variable column width
        const longest = arr.reduce((len, str) => Math.max(len, str.length), 0),
            colWidth = longest + 2,
            perLine = Math.floor(80 / colWidth) || 1;
        return arr.reduce((memo, name, i) => {
            const col = i % perLine;
            if (i > 0 && col === 0) memo += '\n';
            if (col < perLine - 1) { // right-pad all but rightmost column
                name = utils.rpad(name, colWidth - 2, ' ');
            }
            return `${memo}  ${name}`;
        }, '');
    };

    internal.logArgs = function (args) {
        if (internal.LOGGING && !internal.getStateVar('QUIET') && utils.isArrayLike(args)) {
            (console.error || console.log).call(console, internal.formatLogArgs(args)); // eslint-disable-line no-undef
        }
    };

    internal.getWorldBounds = function (e) {
        e = utils.isFiniteNumber(e) ? e : 1e-10;
        return [-180 + e, -90 + e, 180 - e, 90 - e];
    };

    internal.probablyDecimalDegreeBounds = function (b) {
        const world = internal.getWorldBounds(-1), // add a bit of excess
            bbox = (b instanceof Bounds) ? b.toArray() : b;
        return containsBounds(world, bbox);
    };

    internal.clampToWorldBounds = function (b) {
        const bbox = (b instanceof Bounds) ? b.toArray() : b;
        return new Bounds().setBounds(Math.max(bbox[0], -180), Math.max(bbox[1], -90),
            Math.min(bbox[2], 180), Math.min(bbox[3], 90));
    };

    internal.layerHasGeometry = function (lyr) {
        return internal.layerHasPaths(lyr) || internal.layerHasPoints(lyr);
    };

    internal.layerHasPaths = function (lyr) {
        return (lyr.geometry_type == 'polygon' || lyr.geometry_type == 'polyline') &&
            internal.layerHasNonNullShapes(lyr);
    };

    internal.layerHasPoints = function (lyr) {
        return lyr.geometry_type == 'point' && internal.layerHasNonNullShapes(lyr);
    };

    internal.layerHasNonNullShapes = function (lyr) {
        return utils.some(lyr.shapes || [], (shp) => !!shp);
    };

    internal.requireDataFields = function (table, fields) {
        if (!table) {
            stop("Missing attribute data");
        }
        const dataFields = table.getFields(),
            missingFields = utils.difference(fields, dataFields);
        if (missingFields.length > 0) {
            stop("Table is missing one or more fields:\n",
                missingFields, "\nExisting fields:", `\n${internal.formatStringsAsGrid(dataFields)}`);
        }
    };

    internal.requirePolylineLayer = function (lyr, msg) {
        if (!lyr || lyr.geometry_type !== 'polyline') stop(msg || "Expected a polyline layer");
    };

    internal.requirePolygonLayer = function (lyr, msg) {
        if (!lyr || lyr.geometry_type !== 'polygon') stop(msg || "Expected a polygon layer");
    };

    internal.requirePathLayer = function (lyr, msg) {
        if (!lyr || !internal.layerHasPaths(lyr)) stop(msg || "Expected a polygon or polyline layer");
    };


    const R = 6378137;
    const D2R = Math.PI / 180;

// Equirectangular projection
    function degreesToMeters(deg) {
        return deg * D2R * R;
    }

    function distance3D(ax, ay, az, bx, by, bz) {
        const dx = ax - bx,
            dy = ay - by,
            dz = az - bz;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function distanceSq(ax, ay, bx, by) {
        const dx = ax - bx,
            dy = ay - by;
        return dx * dx + dy * dy;
    }

    function distance2D(ax, ay, bx, by) {
        const dx = ax - bx,
            dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function distanceSq3D(ax, ay, az, bx, by, bz) {
        const dx = ax - bx,
            dy = ay - by,
            dz = az - bz;
        return dx * dx + dy * dy + dz * dz;
    }

// Return id of nearest point to x, y, among x0, y0, x1, y1, ...
    function nearestPoint(x, y, ...args) {
        let minIdx = -1,
            minDist = Infinity,
            dist;
        for (let i = 0, j = 0, n = args.length; j < n; i++, j += 2) {
            dist = distanceSq(x, y, args[j], args[j + 1]);
            if (dist < minDist) {
                minDist = dist;
                minIdx = i;
            }
        }
        return minIdx;
    }


// atan2() makes this function fairly slow, replaced by ~2x faster formula
    function innerAngle2(ax, ay, bx, by, cx, cy) {
        const a1 = Math.atan2(ay - by, ax - bx),
            a2 = Math.atan2(cy - by, cx - bx);
        let a3 = Math.abs(a1 - a2);
        if (a3 > Math.PI) {
            a3 = 2 * Math.PI - a3;
        }
        return a3;
    }

// Return angle abc in range [0, 2PI) or NaN if angle is invalid
// (e.g. if length of ab or bc is 0)
    /*
function signedAngle2(ax, ay, bx, by, cx, cy) {
  var a1 = Math.atan2(ay - by, ax - bx),
      a2 = Math.atan2(cy - by, cx - bx),
      a3 = a2 - a1;

  if (ax == bx && ay == by || bx == cx && by == cy) {
    a3 = NaN; // Use NaN for invalid angles
  } else if (a3 >= Math.PI * 2) {
    a3 = 2 * Math.PI - a3;
  } else if (a3 < 0) {
    a3 = a3 + 2 * Math.PI;
  }
  return a3;
}
*/

    function standardAngle(a) {
        const twoPI = Math.PI * 2;
        while (a < 0) {
            a += twoPI;
        }
        while (a >= twoPI) {
            a -= twoPI;
        }
        return a;
    }

    function signedAngle(ax, ay, bx, by, cx, cy) {
        if (ax == bx && ay == by || bx == cx && by == cy) {
            return NaN; // Use NaN for invalid angles
        }
        const abx = ax - bx,
            aby = ay - by,
            cbx = cx - bx,
            cby = cy - by,
            dotp = abx * cbx + aby * cby,
            crossp = abx * cby - aby * cbx,
            a = Math.atan2(crossp, dotp);
        return standardAngle(a);
    }

// Calc bearing in radians at lng1, lat1
    function bearing(lng1, lat1, lng2, lat2) {
        const D2R = Math.PI / 180;
        lng1 *= D2R;
        lng2 *= D2R;
        lat1 *= D2R;
        lat2 *= D2R;
        const y = Math.sin(lng2 - lng1) * Math.cos(lat2),
            x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
        return Math.atan2(y, x);
    }

// Calc angle of turn from ab to bc, in range [0, 2PI)
// Receive lat-lng values in degrees
    function signedAngleSph(alng, alat, blng, blat, clng, clat) {
        if (alng == blng && alat == blat || blng == clng && blat == clat) {
            return NaN;
        }
        const b1 = bearing(blng, blat, alng, alat), // calc bearing at b
            b2 = bearing(blng, blat, clng, clat),
            a = Math.PI * 2 + b1 - b2;
        return standardAngle(a);
    }

    /*
// Convert arrays of lng and lat coords (xsrc, ysrc) into
// x, y, z coords (meters) on the most common spherical Earth model.
//
function convLngLatToSph(xsrc, ysrc, xbuf, ybuf, zbuf) {
  var deg2rad = Math.PI / 180,
      r = R;
  for (var i=0, len=xsrc.length; i<len; i++) {
    var lng = xsrc[i] * deg2rad,
        lat = ysrc[i] * deg2rad,
        cosLat = Math.cos(lat);
    xbuf[i] = Math.cos(lng) * cosLat * r;
    ybuf[i] = Math.sin(lng) * cosLat * r;
    zbuf[i] = Math.sin(lat) * r;
  }
}
*/

// Convert arrays of lng and lat coords (xsrc, ysrc) into
// x, y, z coords (meters) on the most common spherical Earth model.
//
    function convLngLatToSph(xsrc, ysrc, xbuf, ybuf, zbuf) {
        const p = [];
        for (let i = 0, len = xsrc.length; i < len; i++) {
            lngLatToXYZ(xsrc[i], ysrc[i], p);
            xbuf[i] = p[0];
            ybuf[i] = p[1];
            zbuf[i] = p[2];
        }
    }

    function xyzToLngLat(x, y, z, p) {
        const d = distance3D(0, 0, 0, x, y, z); // normalize
        const lat = Math.asin(z / d) / D2R;
        const lng = Math.atan2(y / d, x / d) / D2R;
        p[0] = lng;
        p[1] = lat;
    }

    function lngLatToXYZ(lng, lat, p) {
        lng *= D2R;
        lat *= D2R;
        const cosLat = Math.cos(lat);
        p[0] = Math.cos(lng) * cosLat * R;
        p[1] = Math.sin(lng) * cosLat * R;
        p[2] = Math.sin(lat) * R;
    }

// Haversine formula (well conditioned at small distances)
    function sphericalDistance(lam1, phi1, lam2, phi2) {
        const dlam = lam2 - lam1,
            dphi = phi2 - phi1,
            a = Math.sin(dphi / 2) * Math.sin(dphi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(dlam / 2) * Math.sin(dlam / 2),
            c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return c;
    }

// Receive: coords in decimal degrees;
// Return: distance in meters on spherical earth
    function greatCircleDistance(lng1, lat1, lng2, lat2) {
        const D2R = Math.PI / 180,
            dist = sphericalDistance(lng1 * D2R, lat1 * D2R, lng2 * D2R, lat2 * D2R);
        return dist * R;
    }

// TODO: make this safe for small angles
    function innerAngle(ax, ay, bx, by, cx, cy) {
        const ab = distance2D(ax, ay, bx, by),
            bc = distance2D(bx, by, cx, cy);
        let theta, dotp;
        if (ab === 0 || bc === 0) {
            theta = 0;
        } else {
            dotp = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by)) / (ab * bc);
            if (dotp >= 1 - 1e-14) {
                theta = 0;
            } else if (dotp <= -1 + 1e-14) {
                theta = Math.PI;
            } else {
                theta = Math.acos(dotp); // consider using other formula at small dp
            }
        }
        return theta;
    }

    function innerAngle3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
        const ab = distance3D(ax, ay, az, bx, by, bz),
            bc = distance3D(bx, by, bz, cx, cy, cz);
        let theta, dotp;
        if (ab === 0 || bc === 0) {
            theta = 0;
        } else {
            dotp = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by) + (az - bz) * (cz - bz)) / (ab * bc);
            if (dotp >= 1) {
                theta = 0;
            } else if (dotp <= -1) {
                theta = Math.PI;
            } else {
                theta = Math.acos(dotp); // consider using other formula at small dp
            }
        }
        return theta;
    }

    function triangleArea(ax, ay, bx, by, cx, cy) {
        const area = Math.abs(((ay - cy) * (bx - cx) + (by - cy) * (cx - ax)) / 2);
        return area;
    }

    function detSq(ax, ay, bx, by, cx, cy) {
        const det = ax * by - ax * cy + bx * cy - bx * ay + cx * ay - cx * by;
        return det * det;
    }

    function cosine(ax, ay, bx, by, cx, cy) {
        const den = distance2D(ax, ay, bx, by) * distance2D(bx, by, cx, cy);
        let cos = 0;
        if (den > 0) {
            cos = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by)) / den;
            if (cos > 1) cos = 1; // handle fp rounding error
            else if (cos < -1) cos = -1;
        }
        return cos;
    }

    function cosine3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
        const den = distance3D(ax, ay, az, bx, by, bz) * distance3D(bx, by, bz, cx, cy, cz);
        let cos = 0;
        if (den > 0) {
            cos = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by) + (az - bz) * (cz - bz)) / den;
            if (cos > 1) cos = 1; // handle fp rounding error
            else if (cos < -1) cos = -1;
        }
        return cos;
    }

    function triangleArea3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
        const area = 0.5 * Math.sqrt(detSq(ax, ay, bx, by, cx, cy) +
            detSq(ax, az, bx, bz, cx, cz) + detSq(ay, az, by, bz, cy, cz));
        return area;
    }

// Given point B and segment AC, return the squared distance from B to the
// nearest point on AC
// Receive the squared length of segments AB, BC, AC
// TODO: analyze rounding error. Returns 0 for these coordinates:
//    P: [2, 3 - 1e-8]  AB: [[1, 3], [3, 3]]
//
    function apexDistSq(ab2, bc2, ac2) {
        let dist2;
        if (ac2 === 0) {
            dist2 = ab2;
        } else if (ab2 >= bc2 + ac2) {
            dist2 = bc2;
        } else if (bc2 >= ab2 + ac2) {
            dist2 = ab2;
        } else {
            const dval = (ab2 + ac2 - bc2);
            dist2 = ab2 - dval * dval / ac2 * 0.25;
        }
        if (dist2 < 0) {
            dist2 = 0;
        }
        return dist2;
    }

    function pointSegDistSq(ax, ay, bx, by, cx, cy) {
        const ab2 = distanceSq(ax, ay, bx, by),
            ac2 = distanceSq(ax, ay, cx, cy),
            bc2 = distanceSq(bx, by, cx, cy);
        return apexDistSq(ab2, ac2, bc2);
    }

    function pointSegDistSq3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
        const ab2 = distanceSq3D(ax, ay, az, bx, by, bz),
            ac2 = distanceSq3D(ax, ay, az, cx, cy, cz),
            bc2 = distanceSq3D(bx, by, bz, cx, cy, cz);
        return apexDistSq(ab2, ac2, bc2);
    }


    internal.calcArcBounds = function (xx, yy, start, len) {
        let i = start | 0;
        const n = isNaN(len) ? xx.length - i : len + i;
        let x, y, xmin, ymin, xmax, ymax;
        if (n > 0) {
            xmin = xmax = xx[i];
            ymin = ymax = yy[i];
        }
        for (i++; i < n; i++) {
            x = xx[i];
            y = yy[i];
            if (x < xmin) xmin = x;
            if (x > xmax) xmax = x;
            if (y < ymin) ymin = y;
            if (y > ymax) ymax = y;
        }
        return [xmin, ymin, xmax, ymax];
    };

    internal.reversePathCoords = function (arr, start, len) {
        let i = start,
            j = start + len - 1,
            tmp;
        while (i < j) {
            tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
            i++;
            j--;
        }
    };

    function containsBounds(a, b) {
        return a[0] <= b[0] && a[2] >= b[2] && a[1] <= b[1] && a[3] >= b[3];
    }

// export functions so they can be tested
    const geom = {
        R,
        D2R,
        degreesToMeters,
        segmentHit,
        segmentIntersection,
        distanceSq,
        distance2D,
        distance3D,
        innerAngle,
        innerAngle2,
        signedAngle,
        bearing,
        signedAngleSph,
        standardAngle,
        convLngLatToSph,
        lngLatToXYZ,
        xyzToLngLat,
        sphericalDistance,
        greatCircleDistance,
        pointSegDistSq,
        pointSegDistSq3D,
        innerAngle3D,
        triangleArea,
        triangleArea3D,
        cosine,
        cosine3D
    };

// Constructor takes arrays of coords: xx, yy, zz (optional)
//
    function ArcIter(xx, yy) {
        this._i = 0;
        this._n = 0;
        this._inc = 1;
        this._xx = xx;
        this._yy = yy;
        this.i = 0;
        this.x = 0;
        this.y = 0;
    }

    ArcIter.prototype.init = function (i, len, fw) {
        if (fw) {
            this._i = i;
            this._inc = 1;
        } else {
            this._i = i + len - 1;
            this._inc = -1;
        }
        this._n = len;
        return this;
    };

    ArcIter.prototype.hasNext = function () {
        const i = this._i;
        if (this._n > 0) {
            this._i = i + this._inc;
            this.x = this._xx[i];
            this.y = this._yy[i];
            this.i = i;
            this._n--;
            return true;
        }
        return false;
    };

    function FilteredArcIter(xx, yy, zz) {
        let _zlim = 0,
            _i = 0,
            _inc = 1,
            _stop = 0;

        this.init = function (i, len, fw, zlim) {
            _zlim = zlim || 0;
            if (fw) {
                _i = i;
                _inc = 1;
                _stop = i + len;
            } else {
                _i = i + len - 1;
                _inc = -1;
                _stop = i - 1;
            }
            return this;
        };

        this.hasNext = function () {
            // using local vars is significantly faster when skipping many points
            const zarr = zz,
                i = _i;
            let j = i;
            const zlim = _zlim,
                stop = _stop,
                inc = _inc;
            if (i == stop) return false;
            do {
                j += inc;
            } while (j != stop && zarr[j] < zlim);
            _i = j;
            this.x = xx[i];
            this.y = yy[i];
            this.i = i;
            return true;
        };
    }

// Iterate along a path made up of one or more arcs.
//
    function ShapeIter(arcs) {
        this._arcs = arcs;
        this._i = 0;
        this._n = 0;
        this.x = 0;
        this.y = 0;
    }

    ShapeIter.prototype.hasNext = function () {
        const arc = this._arc;
        if (this._i < this._n === false) {
            return false;
        }
        if (arc.hasNext()) {
            this.x = arc.x;
            this.y = arc.y;
            return true;
        }
        this.nextArc();
        return this.hasNext();
    };

    ShapeIter.prototype.init = function (ids) {
        this._ids = ids;
        this._n = ids.length;
        this.reset();
        return this;
    };

    ShapeIter.prototype.nextArc = function () {
        const i = this._i + 1;
        if (i < this._n) {
            this._arc = this._arcs.getArcIter(this._ids[i]);
            if (i > 0) this._arc.hasNext(); // skip first point
        }
        this._i = i;
    };

    ShapeIter.prototype.reset = function () {
        this._i = -1;
        this.nextArc();
    };


// An interface for managing a collection of paths.
// Constructor signatures:
//
// ArcCollection(arcs)
//    arcs is an array of polyline arcs; each arc is an array of points: [[x0, y0], [x1, y1], ... ]
//
// ArcCollection(nn, xx, yy)
//    nn is an array of arc lengths; xx, yy are arrays of concatenated coords;
    function ArcCollection(...args) {
        let _xx, _yy,  // coordinates data
            _ii, _nn,  // indexes, sizes
            _zz, _zlimit = 0, // simplification
            _bb, _allBounds, // bounding boxes
            _arcIter, _filteredArcIter; // path iterators

        if (args.length == 1) {
            initLegacyArcs(args[0]);  // want to phase this out
        } else if (args.length == 3) {
            initXYData.apply(this, args);
        } else {
            error("ArcCollection() Invalid arguments");
        }

        function initLegacyArcs(arcs) {
            const xx = [], yy = [];
            const nn = arcs.map((points) => {
                const n = points ? points.length : 0;
                for (let i = 0; i < n; i++) {
                    xx.push(points[i][0]);
                    yy.push(points[i][1]);
                }
                return n;
            });
            initXYData(nn, xx, yy);
        }

        function initXYData(nn, xx, yy) {
            const size = nn.length;
            if (nn instanceof Array) nn = new Uint32Array(nn);
            if (xx instanceof Array) xx = new Float64Array(xx);
            if (yy instanceof Array) yy = new Float64Array(yy);
            _xx = xx;
            _yy = yy;
            _nn = nn;
            _zz = null;
            _zlimit = 0;
            _filteredArcIter = null;

            // generate array of starting idxs of each arc
            _ii = new Uint32Array(size);
            let idx, j;
            for (idx = 0, j = 0; j < size; j++) {
                _ii[j] = idx;
                idx += nn[j];
            }

            if (idx != _xx.length || _xx.length != _yy.length) {
                error("ArcCollection#initXYData() Counting error");
            }

            initBounds();
            // Pre-allocate some path iterators for repeated use.
            _arcIter = new ArcIter(_xx, _yy);
            return this;
        }

        function initZData(zz) {
            if (!zz) {
                _zz = null;
                _zlimit = 0;
                _filteredArcIter = null;
            } else {
                if (zz.length != _xx.length) error("ArcCollection#initZData() mismatched arrays");
                if (zz instanceof Array) zz = new Float64Array(zz);
                _zz = zz;
                _filteredArcIter = new FilteredArcIter(_xx, _yy, _zz);
            }
        }

        function initBounds() {
            const data = calcArcBounds(_xx, _yy, _nn);
            _bb = data.bb;
            _allBounds = data.bounds;
        }

        function calcArcBounds(xx, yy, nn) {
            const numArcs = nn.length,
                bb = new Float64Array(numArcs * 4),
                bounds = new Bounds();
            let arcOffs = 0,
                arcLen,
                j, b;
            for (let i = 0; i < numArcs; i++) {
                arcLen = nn[i];
                if (arcLen > 0) {
                    j = i * 4;
                    b = internal.calcArcBounds(xx, yy, arcOffs, arcLen);
                    bb[j++] = b[0];
                    bb[j++] = b[1];
                    bb[j++] = b[2];
                    bb[j] = b[3];
                    arcOffs += arcLen;
                    bounds.mergeBounds(b);
                }
            }
            return {
                bb,
                bounds
            };
        }

        this.updateVertexData = function (nn, xx, yy, zz) {
            initXYData(nn, xx, yy);
            initZData(zz || null);
        };

        // Give access to raw data arrays...
        this.getVertexData = function () {
            return {
                xx: _xx,
                yy: _yy,
                zz: _zz,
                bb: _bb,
                nn: _nn,
                ii: _ii
            };
        };

        this.getCopy = function () {
            const copy = new ArcCollection(new Int32Array(_nn), new Float64Array(_xx),
                new Float64Array(_yy));
            if (_zz) {
                copy.setThresholds(new Float64Array(_zz));
                copy.setRetainedInterval(_zlimit);
            }
            return copy;
        };

        function getFilteredPointCount() {
            const zz = _zz, z = _zlimit;
            if (!zz || !z) return this.getPointCount();
            let count = 0;
            for (let i = 0, n = zz.length; i < n; i++) {
                if (zz[i] >= z) count++;
            }
            return count;
        }

        function getFilteredVertexData() {
            const len2 = getFilteredPointCount();
            const arcCount = _nn.length;
            const xx2 = new Float64Array(len2),
                yy2 = new Float64Array(len2),
                zz2 = new Float64Array(len2),
                nn2 = new Int32Array(arcCount);
            let i = 0, i2 = 0,
                n, n2;

            for (let arcId = 0; arcId < arcCount; arcId++) {
                n2 = 0;
                n = _nn[arcId];
                for (let end = i + n; i < end; i++) {
                    if (_zz[i] >= _zlimit) {
                        xx2[i2] = _xx[i];
                        yy2[i2] = _yy[i];
                        zz2[i2] = _zz[i];
                        i2++;
                        n2++;
                    }
                }
                if (n2 < 2) error("Collapsed arc"); // endpoints should be z == Infinity
                nn2[arcId] = n2;
            }
            return {
                xx: xx2,
                yy: yy2,
                zz: zz2,
                nn: nn2
            };
        }

        this.getFilteredCopy = function () {
            if (!_zz || _zlimit === 0) return this.getCopy();
            const data = getFilteredVertexData();
            const copy = new ArcCollection(data.nn, data.xx, data.yy);
            copy.setThresholds(data.zz);
            return copy;
        };

        // Return arcs as arrays of [x, y] points (intended for testing).
        this.toArray = function () {
            const arr = [];
            this.forEach((iter) => {
                const arc = [];
                while (iter.hasNext()) {
                    arc.push([iter.x, iter.y]);
                }
                arr.push(arc);
            });
            return arr;
        };

        this.toJSON = function () {
            return this.toArray();
        };

        // @cb function(i, j, xx, yy)
        this.forEachArcSegment = function (arcId, cb) {
            const fw = arcId >= 0,
                absId = fw ? arcId : ~arcId,
                zlim = this.getRetainedInterval(),
                n = _nn[absId],
                step = fw ? 1 : -1;
            let v1 = fw ? _ii[absId] : _ii[absId] + n - 1,
                v2 = v1,
                count = 0;

            for (let j = 1; j < n; j++) {
                v2 += step;
                if (zlim === 0 || _zz[v2] >= zlim) {
                    cb(v1, v2, _xx, _yy);
                    v1 = v2;
                    count++;
                }
            }
            return count;
        };

        // @cb function(i, j, xx, yy)
        this.forEachSegment = function (cb) {
            let count = 0;
            for (let i = 0, n = this.size(); i < n; i++) {
                count += this.forEachArcSegment(i, cb);
            }
            return count;
        };

        this.transformPoints = function (f) {
            const xx = _xx, yy = _yy;
            let arcId = -1, n = 0, p;
            for (let i = 0, len = xx.length; i < len; i++, n--) {
                while (n === 0) {
                    n = _nn[++arcId];
                }
                p = f(xx[i], yy[i], arcId);
                if (p) {
                    xx[i] = p[0];
                    yy[i] = p[1];
                }
            }
            initBounds();
        };

        // Return an ArcIter object for each path in the dataset
        //
        this.forEach = function (cb) {
            for (let i = 0, n = this.size(); i < n; i++) {
                cb(this.getArcIter(i), i);
            }
        };

        // Iterate over arcs with access to low-level data
        //
        this.forEach2 = function (cb) {
            for (let arcId = 0, n = this.size(); arcId < n; arcId++) {
                cb(_ii[arcId], _nn[arcId], _xx, _yy, _zz, arcId);
            }
        };

        this.forEach3 = function (cb) {
            let start, end, xx, yy, zz;
            for (let arcId = 0, n = this.size(); arcId < n; arcId++) {
                start = _ii[arcId];
                end = start + _nn[arcId];
                xx = _xx.subarray(start, end);
                yy = _yy.subarray(start, end);
                if (_zz) zz = _zz.subarray(start, end);
                cb(xx, yy, zz, arcId);
            }
        };

        // Remove arcs that don't pass a filter test and re-index arcs
        // Return array mapping original arc ids to re-indexed ids. If arr[n] == -1
        // then arc n was removed. arr[n] == m indicates that the arc at n was
        // moved to index m.
        // Return null if no arcs were re-indexed (and no arcs were removed)
        //
        this.filter = function (cb) {
            const test = function (i) {
                return cb(this.getArcIter(i), i);
            }.bind(this);
            return this.deleteArcs(test);
        };

        this.deleteArcs = function (test) {
            const n = this.size(),
                map = new Int32Array(n);
            let goodArcs = 0;
            for (let i = 0; i < n; i++) {
                if (test(i)) {
                    map[i] = goodArcs++;
                } else {
                    map[i] = -1;
                }
            }
            if (goodArcs < n) {
                condenseArcs(map);
            }
            return map;
        };

        function condenseArcs(map) {
            let goodPoints = 0,
                goodArcs = 0;
            const copyElements = utils.copyElements;
            let k, arcLen;
            for (let i = 0, n = map.length; i < n; i++) {
                k = map[i];
                arcLen = _nn[i];
                if (k > -1) {
                    copyElements(_xx, _ii[i], _xx, goodPoints, arcLen);
                    copyElements(_yy, _ii[i], _yy, goodPoints, arcLen);
                    if (_zz) copyElements(_zz, _ii[i], _zz, goodPoints, arcLen);
                    _nn[k] = arcLen;
                    goodPoints += arcLen;
                    goodArcs++;
                }
            }

            initXYData(_nn.subarray(0, goodArcs), _xx.subarray(0, goodPoints),
                _yy.subarray(0, goodPoints));
            if (_zz) initZData(_zz.subarray(0, goodPoints));
        }

        this.dedupCoords = function () {
            let arcId = 0, i = 0, i2 = 0;
            const arcCount = this.size(),
                zz = _zz;
            let arcLen, arcLen2;
            while (arcId < arcCount) {
                arcLen = _nn[arcId];
                arcLen2 = internal.dedupArcCoords(i, i2, arcLen, _xx, _yy, zz);
                _nn[arcId] = arcLen2;
                i += arcLen;
                i2 += arcLen2;
                arcId++;
            }
            if (i > i2) {
                initXYData(_nn, _xx.subarray(0, i2), _yy.subarray(0, i2));
                if (zz) initZData(zz.subarray(0, i2));
            }
            return i - i2;
        };

        this.getVertex = function (arcId, nth) {
            const i = this.indexOfVertex(arcId, nth);
            return {
                x: _xx[i],
                y: _yy[i]
            };
        };

        // @nth: index of vertex. ~(idx) starts from the opposite endpoint
        this.indexOfVertex = function (arcId, nth) {
            const absId = arcId < 0 ? ~arcId : arcId,
                len = _nn[absId];
            if (nth < 0) nth = len + nth;
            if (absId != arcId) nth = len - nth - 1;
            if (nth < 0 || nth >= len) error("[ArcCollection] out-of-range vertex id");
            return _ii[absId] + nth;
        };

        // Test whether the vertex at index @idx is the endpoint of an arc
        this.pointIsEndpoint = function (idx) {
            const ii = _ii,
                nn = _nn;
            for (let j = 0, n = ii.length; j < n; j++) {
                if (idx === ii[j] || idx === ii[j] + nn[j] - 1) return true;
            }
            return false;
        };

        // Tests if arc endpoints have same x, y coords
        // (arc may still have collapsed);
        this.arcIsClosed = function (arcId) {
            const i = this.indexOfVertex(arcId, 0),
                j = this.indexOfVertex(arcId, -1);
            return i != j && _xx[i] == _xx[j] && _yy[i] == _yy[j];
        };

        // Tests if first and last segments mirror each other
        // A 3-vertex arc with same endpoints tests true
        this.arcIsLollipop = function (arcId) {
            const len = this.getArcLength(arcId);
            if (len <= 2 || !this.arcIsClosed(arcId)) return false;
            const i = this.indexOfVertex(arcId, 1);
            const j = this.indexOfVertex(arcId, -2);
            return _xx[i] == _xx[j] && _yy[i] == _yy[j];
        };

        this.arcIsDegenerate = function (arcId) {
            const iter = this.getArcIter(arcId);
            let i = 0,
                x, y;
            while (iter.hasNext()) {
                if (i > 0) {
                    if (x != iter.x || y != iter.y) return false;
                }
                x = iter.x;
                y = iter.y;
                i++;
            }
            return true;
        };

        this.getArcLength = function (arcId) {
            return _nn[absArcId(arcId)];
        };

        this.getArcIter = function (arcId) {
            const fw = arcId >= 0,
                i = fw ? arcId : ~arcId,
                iter = _zz && _zlimit ? _filteredArcIter : _arcIter;
            if (i >= _nn.length) {
                error("#getArcId() out-of-range arc id:", arcId);
            }
            return iter.init(_ii[i], _nn[i], fw, _zlimit);
        };

        this.getShapeIter = function (ids) {
            return new ShapeIter(this).init(ids);
        };

        // Add simplification data to the dataset
        // @thresholds is either a single typed array or an array of arrays of removal thresholds for each arc;
        //
        this.setThresholds = function (thresholds) {
            const n = this.getPointCount();
            let zz = null;
            if (!thresholds) {
                // nop
            } else if (thresholds.length == n) {
                zz = thresholds;
            } else if (thresholds.length == this.size()) {
                zz = flattenThresholds(thresholds, n);
            } else {
                error("Invalid threshold data");
            }
            initZData(zz);
            return this;
        };

        function flattenThresholds(arr, n) {
            const zz = new Float64Array(n);
            let i = 0;
            arr.forEach((arr) => {
                for (let j = 0, n = arr.length; j < n; i++, j++) {
                    zz[i] = arr[j];
                }
            });
            if (i != n) error("Mismatched thresholds");
            return zz;
        }

        // bake in current simplification level, if any
        this.flatten = function () {
            if (_zlimit > 0) {
                const data = getFilteredVertexData();
                this.updateVertexData(data.nn, data.xx, data.yy);
                _zlimit = 0;
            } else {
                _zz = null;
            }
        };

        this.getRetainedInterval = function () {
            return _zlimit;
        };

        this.setRetainedInterval = function (z) {
            _zlimit = z;
            return this;
        };

        this.getRetainedPct = function () {
            return this.getPctByThreshold(_zlimit);
        };

        this.setRetainedPct = function (pct) {
            if (pct >= 1) {
                _zlimit = 0;
            } else {
                _zlimit = this.getThresholdByPct(pct);
                _zlimit = internal.clampIntervalByPct(_zlimit, pct);
            }
            return this;
        };

        // Return array of z-values that can be removed for simplification
        //
        this.getRemovableThresholds = function (nth) {
            if (!_zz) error("[arcs] Missing simplification data.");
            const skip = nth | 1,
                arr = new Float64Array(Math.ceil(_zz.length / skip));
            let z, i, j, n;
            for (i = 0, j = 0, n = this.getPointCount(); i < n; i += skip) {
                z = _zz[i];
                if (z != Infinity) {
                    arr[j++] = z;
                }
            }
            return arr.subarray(0, j);
        };

        this.getArcThresholds = function (arcId) {
            if (!(arcId >= 0 && arcId < this.size())) {
                error("[arcs] Invalid arc id:", arcId);
            }
            const start = _ii[arcId],
                end = start + _nn[arcId];
            return _zz.subarray(start, end);
        };

        // nth (optional): sample every nth threshold (use estimate for speed)
        this.getPctByThreshold = function (val, nth) {
            let arr, rank, pct;
            if (val > 0) {
                arr = this.getRemovableThresholds(nth);
                rank = utils.findRankByValue(arr, val);
                pct = arr.length > 0 ? 1 - (rank - 1) / arr.length : 1;
            } else {
                pct = 1;
            }
            return pct;
        };

        // nth (optional): sample every nth threshold (use estimate for speed)
        this.getThresholdByPct = function (pct, nth) {
            const tmp = this.getRemovableThresholds(nth);
            let rank, z;
            if (tmp.length === 0) { // No removable points
                rank = 0;
            } else {
                rank = Math.floor((1 - pct) * (tmp.length + 2));
            }

            if (rank <= 0) {
                z = 0;
            } else if (rank > tmp.length) {
                z = Infinity;
            } else {
                z = utils.findValueByRank(tmp, rank);
            }
            return z;
        };

        this.arcIntersectsBBox = function (i, b1) {
            const b2 = _bb,
                j = i * 4;
            return b2[j] <= b1[2] && b2[j + 2] >= b1[0] && b2[j + 3] >= b1[1] && b2[j + 1] <= b1[3];
        };

        this.arcIsContained = function (i, b1) {
            const b2 = _bb,
                j = i * 4;
            return b2[j] >= b1[0] && b2[j + 2] <= b1[2] && b2[j + 1] >= b1[1] && b2[j + 3] <= b1[3];
        };

        this.arcIsSmaller = function (i, units) {
            const bb = _bb,
                j = i * 4;
            return bb[j + 2] - bb[j] < units && bb[j + 3] - bb[j + 1] < units;
        };

        // TODO: allow datasets in lat-lng coord range to be flagged as planar
        this.isPlanar = function () {
            return !internal.probablyDecimalDegreeBounds(this.getBounds());
        };

        this.size = function () {
            return _ii && _ii.length || 0;
        };

        this.getPointCount = function () {
            return _xx && _xx.length || 0;
        };

        this.getBounds = function () {
            return _allBounds.clone();
        };

        this.getSimpleShapeBounds = function (arcIds, bounds) {
            bounds = bounds || new Bounds();
            for (let i = 0, n = arcIds.length; i < n; i++) {
                this.mergeArcBounds(arcIds[i], bounds);
            }
            return bounds;
        };

        this.getSimpleShapeBounds2 = function (arcIds, arr) {
            const bbox = arr || [],
                bb = _bb;
            let id = absArcId(arcIds[0]) * 4;
            bbox[0] = bb[id];
            bbox[1] = bb[++id];
            bbox[2] = bb[++id];
            bbox[3] = bb[++id];
            for (let i = 1, n = arcIds.length; i < n; i++) {
                id = absArcId(arcIds[i]) * 4;
                if (bb[id] < bbox[0]) bbox[0] = bb[id];
                if (bb[++id] < bbox[1]) bbox[1] = bb[id];
                if (bb[++id] > bbox[2]) bbox[2] = bb[id];
                if (bb[++id] > bbox[3]) bbox[3] = bb[id];
            }
            return bbox;
        };

        // TODO: move this and similar methods out of ArcCollection
        this.getMultiShapeBounds = function (shapeIds, bounds) {
            bounds = bounds || new Bounds();
            if (shapeIds) { // handle null shapes
                for (let i = 0, n = shapeIds.length; i < n; i++) {
                    this.getSimpleShapeBounds(shapeIds[i], bounds);
                }
            }
            return bounds;
        };

        this.mergeArcBounds = function (arcId, bounds) {
            if (arcId < 0) arcId = ~arcId;
            const offs = arcId * 4;
            bounds.mergeBounds(_bb[offs], _bb[offs + 1], _bb[offs + 2], _bb[offs + 3]);
        };
    }

    ArcCollection.prototype.inspect = function () {
        const n = this.getPointCount();
        let str;
        if (n < 50) {
            str = JSON.stringify(this.toArray());
        } else {
            str = `[ArcCollection (${this.size()})]`;
        }
        return str;
    };

// Remove duplicate coords and NaNs
    internal.dedupArcCoords = function (src, dest, arcLen, xx, yy, zz) {
        let n = 0, n2 = 0; // counters
        let x, y, i, j, keep;
        while (n < arcLen) {
            j = src + n;
            x = xx[j];
            y = yy[j];
            keep = x == x && y == y && (n2 === 0 || x != xx[j - 1] || y != yy[j - 1]);
            if (keep) {
                i = dest + n2;
                xx[i] = x;
                yy[i] = y;
                n2++;
            }
            if (zz && n2 > 0 && (keep || zz[j] > zz[i])) {
                zz[i] = zz[j];
            }
            n++;
        }
        return n2 > 1 ? n2 : 0;
    };


    geom.segmentIntersection = segmentIntersection;
    geom.segmentHit = segmentHit;
    geom.lineIntersection = lineIntersection;
    geom.orient2D = orient2D;
    geom.outsideRange = outsideRange;

// Find the interection between two 2D segments
// Returns 0, 1 or two x, y locations as null, [x, y], or [x1, y1, x2, y2]
// Special cases:
// If the segments touch at an endpoint of both segments, it is not treated as an intersection
// If the segments touch at a T-intersection, it is treated as an intersection
// If the segments are collinear and partially overlapping, each subsumed endpoint
//    is counted as an intersection (there will be one or two)
//
    function segmentIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
        const hit = segmentHit(ax, ay, bx, by, cx, cy, dx, dy);
        let p = null;
        if (hit) {
            p = crossIntersection(ax, ay, bx, by, cx, cy, dx, dy);
            if (!p) { // collinear if p is null
                p = collinearIntersection(ax, ay, bx, by, cx, cy, dx, dy);
            } else if (endpointHit(ax, ay, bx, by, cx, cy, dx, dy)) {
                p = null; // filter out segments that only intersect at an endpoint
            }
        }
        return p;
    }

    function lineIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
        const den = determinant2D(bx - ax, by - ay, dx - cx, dy - cy);
        const eps = 1e-18;
        let p;
        if (den === 0) return null;
        const m = orient2D(cx, cy, dx, dy, ax, ay) / den;
        if (den <= eps && den >= -eps) {
            // tiny denominator = low precision; using one of the endpoints as intersection
            p = findEndpointInRange(ax, ay, bx, by, cx, cy, dx, dy);
            if (!p) {
                debug('[lineIntersection()]');
                geom.debugSegmentIntersection([], ax, ay, bx, by, cx, cy, dx, dy);
            }
        } else {
            p = [ax + m * (bx - ax), ay + m * (by - ay)];
        }
        return p;
    }

    function findEndpointInRange(ax, ay, bx, by, cx, cy, dx, dy) {
        let p = null;
        if (!outsideRange(ax, cx, dx) && !outsideRange(ay, cy, dy)) {
            p = [ax, ay];
        } else if (!outsideRange(bx, cx, dx) && !outsideRange(by, cy, dy)) {
            p = [bx, by];
        } else if (!outsideRange(cx, ax, bx) && !outsideRange(cy, ay, by)) {
            p = [cx, cy];
        } else if (!outsideRange(dx, ax, bx) && !outsideRange(dy, ay, by)) {
            p = [dx, dy];
        }
        return p;
    }

// Get intersection point if segments are non-collinear, else return null
// Assumes that segments have been intersect
    function crossIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
        let p = lineIntersection(ax, ay, bx, by, cx, cy, dx, dy);
        let nearest;
        if (p) {
            // Re-order operands so intersection point is closest to a (better precision)
            // Source: Jonathan Shewchuk http://www.cs.berkeley.edu/~jrs/meshpapers/robnotes.pdf
            nearest = nearestPoint(p[0], p[1], ax, ay, bx, by, cx, cy, dx, dy);
            if (nearest == 1) {
                p = lineIntersection(bx, by, ax, ay, cx, cy, dx, dy);
            } else if (nearest == 2) {
                p = lineIntersection(cx, cy, dx, dy, ax, ay, bx, by);
            } else if (nearest == 3) {
                p = lineIntersection(dx, dy, cx, cy, ax, ay, bx, by);
            }
        }
        if (p) {
            clampIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy);
        }
        return p;
    }

    function clampIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy) {
        // Handle intersection points that fall outside the x-y range of either
        // segment by snapping to nearest endpoint coordinate. Out-of-range
        // intersection points can be caused by floating point rounding errors
        // when a segment is vertical or horizontal. This has caused problems when
        // repeatedly applying bbox clipping along the same segment
        let x = p[0],
            y = p[1];
        // assumes that segment ranges intersect
        x = geom.clampToCloseRange(x, ax, bx);
        x = geom.clampToCloseRange(x, cx, dx);
        y = geom.clampToCloseRange(y, ay, by);
        y = geom.clampToCloseRange(y, cy, dy);
        p[0] = x;
        p[1] = y;
    }

    geom.debugSegmentIntersection = function (p, ax, ay, bx, by, cx, cy, dx, dy) {
        debug('[debugSegmentIntersection()]');
        debug('  s1\n  dx:', Math.abs(ax - bx), '\n  dy:', Math.abs(ay - by));
        debug('  s2\n  dx:', Math.abs(cx - dx), '\n  dy:', Math.abs(cy - dy));
        debug('  s1 xx:', ax, bx);
        debug('  s2 xx:', cx, dx);
        debug('  s1 yy:', ay, by);
        debug('  s2 yy:', cy, dy);
        debug('  angle:', geom.signedAngle(ax, ay, bx, by, dx - cx + bx, dy - cy + by));
    };

// a: coordinate of point
// b: endpoint coordinate of segment
// c: other endpoint of segment
    function outsideRange(a, b, c) {
        let out;
        if (b < c) {
            out = a < b || a > c;
        } else if (b > c) {
            out = a > b || a < c;
        } else {
            out = a != b;
        }
        return out;
    }

    geom.clampToCloseRange = function (a, b, c) {
        let lim;
        if (geom.outsideRange(a, b, c)) {
            lim = Math.abs(a - b) < Math.abs(a - c) ? b : c;
            if (Math.abs(a - lim) > 1e-15) {
                debug("[clampToCloseRange()] large clamping interval", a, b, c);
            }
            a = lim;
        }
        return a;
    };

// Used by mapshaper-gaps.js
// TODO: make more robust, make sure result is compatible with segmentIntersection()
// (rounding errors currently must be handled downstream)
    geom.findClosestPointOnSeg = function (px, py, ax, ay, bx, by) {
        const dx = bx - ax,
            dy = by - ay,
            dotp = (px - ax) * dx + (py - ay) * dy,
            abSq = dx * dx + dy * dy,
            k = abSq === 0 ? -1 : dotp / abSq,
            eps = 0.1; // 1e-6, // snap to endpoint
        let p;
        if (k <= eps) {
            p = [ax, ay];
        } else if (k >= 1 - eps) {
            p = [bx, by];
        } else {
            p = [ax + k * dx, ay + k * dy];
        }
        return p;
    };


// Determinant of matrix
//  | a  b |
//  | c  d |
    function determinant2D(a, b, c, d) {
        return a * d - b * c;
    }

// returns a positive value if the points a, b, and c are arranged in
// counterclockwise order, a negative value if the points are in clockwise
// order, and zero if the points are collinear.
// Source: Jonathan Shewchuk http://www.cs.berkeley.edu/~jrs/meshpapers/robnotes.pdf
    function orient2D(ax, ay, bx, by, cx, cy) {
        return determinant2D(ax - cx, ay - cy, bx - cx, by - cy);
    }

// Source: Sedgewick, _Algorithms in C_
// (Tried various other functions that failed owing to floating point errors)
    function segmentHit(ax, ay, bx, by, cx, cy, dx, dy) {
        return orient2D(ax, ay, bx, by, cx, cy) *
            orient2D(ax, ay, bx, by, dx, dy) <= 0 &&
            orient2D(cx, cy, dx, dy, ax, ay) *
            orient2D(cx, cy, dx, dy, bx, by) <= 0;
    }

    function inside(x, minX, maxX) {
        return x > minX && x < maxX;
    }

// Assume segments s1 and s2 are collinear and overlap; find one or two internal endpoints
    function collinearIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
        const minX = Math.min(ax, bx, cx, dx),
            maxX = Math.max(ax, bx, cx, dx),
            minY = Math.min(ay, by, cy, dy),
            maxY = Math.max(ay, by, cy, dy),
            useY = maxY - minY > maxX - minX;
        let coords = [];

        if (useY ? inside(ay, minY, maxY) : inside(ax, minX, maxX)) {
            coords.push(ax, ay);
        }
        if (useY ? inside(by, minY, maxY) : inside(bx, minX, maxX)) {
            coords.push(bx, by);
        }
        if (useY ? inside(cy, minY, maxY) : inside(cx, minX, maxX)) {
            coords.push(cx, cy);
        }
        if (useY ? inside(dy, minY, maxY) : inside(dx, minX, maxX)) {
            coords.push(dx, dy);
        }
        if (coords.length != 2 && coords.length != 4) {
            coords = null;
            debug("Invalid collinear segment intersection", coords);
        } else if (coords.length == 4 && coords[0] == coords[2] && coords[1] == coords[3]) {
            // segs that meet in the middle don't count
            coords = null;
        }
        return coords;
    }

    function endpointHit(ax, ay, bx, by, cx, cy, dx, dy) {
        return ax == cx && ay == cy || ax == dx && ay == dy ||
            bx == cx && by == cy || bx == dx && by == dy;
    }


// @xx array of x coords
// @ids an array of segment endpoint ids [a0, b0, a1, b1, ...]
// Sort @ids in place so that xx[a(n)] <= xx[b(n)] and xx[a(n)] <= xx[a(n+1)]
    internal.sortSegmentIds = function (xx, ids) {
        internal.orderSegmentIds(xx, ids);
        internal.quicksortSegmentIds(xx, ids, 0, ids.length - 2);
    };

    internal.orderSegmentIds = function (xx, ids) {
        function swap(i, j) {
            const tmp = ids[i];
            ids[i] = ids[j];
            ids[j] = tmp;
        }

        for (let i = 0, n = ids.length; i < n; i += 2) {
            if (xx[ids[i]] > xx[ids[i + 1]]) {
                swap(i, i + 1);
            }
        }
    };

    internal.insertionSortSegmentIds = function (arr, ids, start, end) {
        let id, id2;
        for (let j = start + 2; j <= end; j += 2) {
            id = ids[j];
            id2 = ids[j + 1];
            let i;
            for (i = j - 2; i >= start && arr[id] < arr[ids[i]]; i -= 2) {
                ids[i + 2] = ids[i];
                ids[i + 3] = ids[i + 1];
            }
            ids[i + 2] = id;
            ids[i + 3] = id2;
        }
    };

    internal.quicksortSegmentIds = function (a, ids, lo, hi) {
        let i = lo,
            j = hi,
            pivot, tmp;
        while (i < hi) {
            pivot = a[ids[(lo + hi >> 2) << 1]]; // avoid n^2 performance on sorted arrays
            while (i <= j) {
                while (a[ids[i]] < pivot) i += 2;
                while (a[ids[j]] > pivot) j -= 2;
                if (i <= j) {
                    tmp = ids[i];
                    ids[i] = ids[j];
                    ids[j] = tmp;
                    tmp = ids[i + 1];
                    ids[i + 1] = ids[j + 1];
                    ids[j + 1] = tmp;
                    i += 2;
                    j -= 2;
                }
            }

            if (j - lo < 40) internal.insertionSortSegmentIds(a, ids, lo, j);
            else internal.quicksortSegmentIds(a, ids, lo, j);
            if (hi - i < 40) {
                internal.insertionSortSegmentIds(a, ids, i, hi);
                return;
            }
            lo = i;
            j = hi;
        }
    };


// Convert an array of intersections into an ArcCollection (for display)
//
    internal.getIntersectionPoints = function (intersections) {
        return intersections.map((obj) => [obj.x, obj.y]);
    };

// Identify intersecting segments in an ArcCollection
//
// To find all intersections:
// 1. Assign each segment to one or more horizontal stripes/bins
// 2. Find intersections inside each stripe
// 3. Concat and dedup
//
    internal.findSegmentIntersections = (function () {

        // Re-use buffer for temp data -- Chrome's gc starts bogging down
        // if large buffers are repeatedly created.
        let buf;

        function getUint32Array(count) {
            const bytes = count * 4;
            if (!buf || buf.byteLength < bytes) {
                buf = new ArrayBuffer(bytes);
            }
            return new Uint32Array(buf, 0, count);
        }

        return function (arcs) {
            const bounds = arcs.getBounds(),
                // TODO: handle spherical bounds
                ymin = bounds.ymin,
                yrange = bounds.ymax - ymin,
                stripeCount = internal.calcSegmentIntersectionStripeCount(arcs),
                stripeSizes = new Uint32Array(stripeCount),
                stripeId = stripeCount > 1 ? multiStripeId : singleStripeId;
                let i, j;

            function multiStripeId(y) {
                return Math.floor((stripeCount - 1) * (y - ymin) / yrange);
            }

            function singleStripeId() {
                return 0;
            }

            // Count segments in each stripe
            arcs.forEachSegment((id1, id2, xx, yy) => {
                let s1 = stripeId(yy[id1]);
                const s2 = stripeId(yy[id2]);
                while (true) { // eslint-disable-line no-constant-condition
                    stripeSizes[s1] = stripeSizes[s1] + 2;
                    if (s1 == s2) break;
                    s1 += s2 > s1 ? 1 : -1;
                }
            });

            // Allocate arrays for segments in each stripe
            const stripeData = getUint32Array(utils.sum(stripeSizes));
            let offs = 0;
            const stripes = [];
            utils.forEach(stripeSizes, (stripeSize) => {
                const start = offs;
                offs += stripeSize;
                stripes.push(stripeData.subarray(start, offs));
            });
            // Assign segment ids to each stripe
            utils.initializeArray(stripeSizes, 0);

            arcs.forEachSegment((id1, id2, xx, yy) => {
                let s1 = stripeId(yy[id1]);
                const s2 = stripeId(yy[id2]);
                let count, stripe;
                while (true) { // eslint-disable-line no-constant-condition
                    count = stripeSizes[s1];
                    stripeSizes[s1] = count + 2;
                    stripe = stripes[s1];
                    stripe[count] = id1;
                    stripe[count + 1] = id2;
                    if (s1 == s2) break;
                    s1 += s2 > s1 ? 1 : -1;
                }
            });

            // Detect intersections among segments in each stripe.
            const raw = arcs.getVertexData(),
                intersections = [];
            let arr;
            for (i = 0; i < stripeCount; i++) {
                arr = internal.intersectSegments(stripes[i], raw.xx, raw.yy);
                for (j = 0; j < arr.length; j++) {
                    intersections.push(arr[j]);
                }
            }
            return internal.dedupIntersections(intersections);
        };
    })();

    internal.sortIntersections = function (arr) {
        arr.sort((a, b) => a.x - b.x || a.y - b.y);
    };

    internal.dedupIntersections = function (arr) {
        const index = {};
        return arr.filter((o) => {
            const key = internal.getIntersectionKey(o);
            if (key in index) {
                return false;
            }
            index[key] = true;
            return true;
        });
    };

// Get an indexable key from an intersection object
// Assumes that vertex ids of o.a and o.b are sorted
    internal.getIntersectionKey = function (o) {
        return `${o.a.join(',')};${o.b.join(',')}`;
    };

    internal.calcSegmentIntersectionStripeCount = function (arcs) {
        const yrange = arcs.getBounds().height(),
            segLen = internal.getAvgSegment2(arcs)[1];
        let count = 1;
        if (segLen > 0 && yrange > 0) {
            count = Math.ceil(yrange / segLen / 20);
        }
        return count || 1;
    };

// Find intersections among a group of line segments
//
// TODO: handle case where a segment starts and ends at the same point (i.e. duplicate coords);
//
// @ids: Array of indexes: [s0p0, s0p1, s1p0, s1p1, ...] where xx[sip0] <= xx[sip1]
// @xx, @yy: Arrays of x- and y-coordinates
//
    internal.intersectSegments = function (ids, xx, yy) {
        const lim = ids.length - 2,
            intersections = [];
        let s1p1, s1p2, s2p1, s2p2,
            s1p1x, s1p2x, s2p1x, s2p2x,
            s1p1y, s1p2y, s2p1y, s2p2y,
            hit, seg1, seg2, i, j;

        // Sort segments by xmin, to allow efficient exclusion of segments with
        // non-overlapping x extents.
        internal.sortSegmentIds(xx, ids); // sort by ascending xmin

        i = 0;
        while (i < lim) {
            s1p1 = ids[i];
            s1p2 = ids[i + 1];
            s1p1x = xx[s1p1];
            s1p2x = xx[s1p2];
            s1p1y = yy[s1p1];
            s1p2y = yy[s1p2];
            // count++;

            j = i;
            while (j < lim) {
                j += 2;
                s2p1 = ids[j];
                s2p1x = xx[s2p1];

                if (s1p2x < s2p1x) break; // x extent of seg 2 is greater than seg 1: done with seg 1
                //if (s1p2x <= s2p1x) break; // this misses point-segment intersections when s1 or s2 is vertical

                s2p1y = yy[s2p1];
                s2p2 = ids[j + 1];
                s2p2x = xx[s2p2];
                s2p2y = yy[s2p2];

                // skip segments with non-overlapping y ranges
                if (s1p1y >= s2p1y) {
                    if (s1p1y > s2p2y && s1p2y > s2p1y && s1p2y > s2p2y) continue;
                } else {
                    if (s1p1y < s2p2y && s1p2y < s2p1y && s1p2y < s2p2y) continue;
                }

                // skip segments that are adjacent in a path (optimization)
                // TODO: consider if this eliminates some cases that should
                // be detected, e.g. spikes formed by unequal segments
                if (s1p1 == s2p1 || s1p1 == s2p2 || s1p2 == s2p1 || s1p2 == s2p2) {
                    continue;
                }

                // test two candidate segments for intersection
                hit = segmentIntersection(s1p1x, s1p1y, s1p2x, s1p2y,
                    s2p1x, s2p1y, s2p2x, s2p2y);
                if (hit) {
                    seg1 = [s1p1, s1p2];
                    seg2 = [s2p1, s2p2];
                    intersections.push(internal.formatIntersection(hit, seg1, seg2, xx, yy));
                    if (hit.length == 4) {
                        // two collinear segments may have two endpoint intersections
                        intersections.push(internal.formatIntersection(hit.slice(2), seg1, seg2, xx, yy));
                    }
                }
            }
            i += 2;
        }
        return intersections;
    };

    internal.formatIntersection = function (xy, s1, s2, xx, yy) {
        const x = xy[0],
            y = xy[1];
        s1 = internal.formatIntersectingSegment(x, y, s1[0], s1[1], xx, yy);
        s2 = internal.formatIntersectingSegment(x, y, s2[0], s2[1], xx, yy);
        const a = s1[0] < s2[0] ? s1 : s2;
        const b = a == s1 ? s2 : s1;
        return {x, y, a, b};
    };

    internal.formatIntersectingSegment = function (x, y, id1, id2, xx, yy) {
        let i = id1 < id2 ? id1 : id2,
            j = i === id1 ? id2 : id1;
        if (xx[i] == x && yy[i] == y) {
            j = i;
        } else if (xx[j] == x && yy[j] == y) {
            i = j;
        }
        return [i, j];
    };


// Utility functions for working with ArcCollection and arrays of arc ids.

// Return average segment length (with simplification)
    internal.getAvgSegment = function (arcs) {
        let sum = 0;
        const count = arcs.forEachSegment((i, j, xx, yy) => {
            const dx = xx[i] - xx[j],
                dy = yy[i] - yy[j];
            sum += Math.sqrt(dx * dx + dy * dy);
        });
        return sum / count || 0;
    };

// Return average magnitudes of dx, dy (with simplification)
    internal.getAvgSegment2 = function (arcs) {
        let dx = 0, dy = 0;
        const count = arcs.forEachSegment((i, j, xx, yy) => {
            dx += Math.abs(xx[i] - xx[j]);
            dy += Math.abs(yy[i] - yy[j]);
        });
        return [dx / count || 0, dy / count || 0];
    };

    /*
this.getAvgSegmentSph2 = function() {
  var sumx = 0, sumy = 0;
  var count = this.forEachSegment(function(i, j, xx, yy) {
    var lat1 = yy[i],
        lat2 = yy[j];
    sumy += geom.degreesToMeters(Math.abs(lat1 - lat2));
    sumx += geom.degreesToMeters(Math.abs(xx[i] - xx[j]) *
        Math.cos((lat1 + lat2) * 0.5 * geom.D2R);
  });
  return [sumx / count || 0, sumy / count || 0];
};
*/

    internal.getDirectedArcPresenceTest = function (shapes, n) {
        const flags = new Uint8Array(n);
        internal.forEachArcId(shapes, (id) => {
            const absId = absArcId(id);
            if (absId < n === false) error('index error');
            flags[absId] |= id < 0 ? 2 : 1;
        });
        return function (arcId) {
            const absId = absArcId(arcId);
            return arcId < 0 ? (flags[absId] & 2) == 2 : (flags[absId] & 1) == 1;
        };
    };

    internal.getArcPresenceTest = function (shapes, arcs) {
        const counts = new Uint8Array(arcs.size());
        internal.countArcsInShapes(shapes, counts);
        return function (id) {
            if (id < 0) id = ~id;
            return counts[id] > 0;
        };
    };

    internal.getArcPresenceTest2 = function (layers, arcs) {
        const counts = internal.countArcsInLayers(layers, arcs);
        return function (arcId) {
            return counts[absArcId(arcId)] > 0;
        };
    };

// @counts A typed array for accumulating count of each abs arc id
//   (assume it won't overflow)
    internal.countArcsInShapes = function (shapes, counts) {
        internal.traversePaths(shapes, null, (obj) => {
            const arcs = obj.arcs;
            let id;
            for (let i = 0; i < arcs.length; i++) {
                id = arcs[i];
                if (id < 0) id = ~id;
                counts[id]++;
            }
        });
    };

// Count arcs in a collection of layers
    internal.countArcsInLayers = function (layers, arcs) {
        const counts = new Uint32Array(arcs.size());
        layers.forEach((lyr) => {
            internal.countArcsInShapes(lyr.shapes, counts);
        });
        return counts;
    };

// Returns subset of shapes in @shapes that contain one or more arcs in @arcIds
    internal.findShapesByArcId = function (shapes, arcIds, numArcs) {
        const index = numArcs ? new Uint8Array(numArcs) : [],
            found = [];
        arcIds.forEach((id) => {
            index[absArcId(id)] = 1;
        });
        shapes.forEach((shp, shpId) => {
            let isHit = false;
            internal.forEachArcId(shp || [], (id) => {
                isHit = isHit || index[absArcId(id)] == 1;
            });
            if (isHit) {
                found.push(shpId);
            }
        });
        return found;
    };

    internal.reversePath = function (ids) {
        ids.reverse();
        for (let i = 0, n = ids.length; i < n; i++) {
            ids[i] = ~ids[i];
        }
    };

    internal.clampIntervalByPct = function (z, pct) {
        if (pct <= 0) z = Infinity;
        else if (pct >= 1) z = 0;
        return z;
    };

    internal.findNextRemovableVertices = function (zz, zlim, start, end) {
        let i = internal.findNextRemovableVertex(zz, zlim, start, end),
            arr, k;
        if (i > -1) {
            k = zz[i];
            arr = [i];
            while (++i < end) {
                if (zz[i] == k) {
                    arr.push(i);
                }
            }
        }
        return arr || null;
    };

// Return id of the vertex between @start and @end with the highest
// threshold that is less than @zlim, or -1 if none
//
    internal.findNextRemovableVertex = function (zz, zlim, start, end) {
        let tmp, jz = 0, j = -1, z;
        if (start > end) {
            tmp = start;
            start = end;
            end = tmp;
        }
        for (let i = start + 1; i < end; i++) {
            z = zz[i];
            if (z < zlim && z > jz) {
                j = i;
                jz = z;
            }
        }
        return j;
    };

// Visit each arc id in a path, shape or array of shapes
// Use non-undefined return values of callback @cb as replacements.
    internal.forEachArcId = function (arr, cb) {
        let item;
        for (let i = 0; i < arr.length; i++) {
            item = arr[i];
            if (item instanceof Array) {
                internal.forEachArcId(item, cb);
            } else if (utils.isInteger(item)) {
                const val = cb(item);
                if (val !== void 0) {
                    arr[i] = val;
                }
            } else if (item) {
                error("Non-integer arc id in:", arr);
            }
        }
    };

    internal.forEachSegmentInShape = function (shape, arcs, cb) {
        for (let i = 0, n = shape ? shape.length : 0; i < n; i++) {
            internal.forEachSegmentInPath(shape[i], arcs, cb);
        }
    };

    internal.forEachSegmentInPath = function (ids, arcs, cb) {
        for (let i = 0, n = ids.length; i < n; i++) {
            arcs.forEachArcSegment(ids[i], cb);
        }
    };

    internal.traversePaths = function traversePaths(shapes, cbArc, cbPart, cbShape) {
        let segId = 0;
        shapes.forEach((parts, shapeId) => {
            if (!parts || parts.length === 0) return; // null shape
            let arcIds, arcId;
            if (cbShape) {
                cbShape(shapeId);
            }
            for (let i = 0, m = parts.length; i < m; i++) {
                arcIds = parts[i];
                if (cbPart) {
                    cbPart({
                        i,
                        shapeId,
                        shape: parts,
                        arcs: arcIds
                    });
                }

                if (cbArc) {
                    for (let j = 0, n = arcIds.length; j < n; j++, segId++) {
                        arcId = arcIds[j];
                        cbArc({
                            i: j,
                            shapeId,
                            partId: i,
                            arcId,
                            segId
                        });
                    }
                }
            }
        });
    };

    internal.arcHasLength = function (id, coords) {
        const iter = coords.getArcIter(id);
        let x, y;
        if (iter.hasNext()) {
            x = iter.x;
            y = iter.y;
            while (iter.hasNext()) {
                if (iter.x != x || iter.y != y) return true;
            }
        }
        return false;
    };

    internal.filterEmptyArcs = function (shape, coords) {
        if (!shape) return null;
        const shape2 = [];
        shape.forEach((ids) => {
            const path = [];
            for (let i = 0; i < ids.length; i++) {
                if (internal.arcHasLength(ids[i], coords)) {
                    path.push(ids[i]);
                }
            }
            if (path.length > 0) shape2.push(path);
        });
        return shape2.length > 0 ? shape2 : null;
    };

// Bundle holes with their containing rings for Topo/GeoJSON polygon export.
// Assumes outer rings are CW and inner (hole) rings are CCW, unless
//   the reverseWinding flag is set.
// @paths array of objects with path metadata -- see internal.exportPathData()
//
// TODO: Improve reliability. Currently uses winding order, area and bbox to
//   identify holes and their enclosures -- could be confused by some strange
//   geometry.
//
    internal.groupPolygonRings = function (paths, reverseWinding) {
        const holes = [],
            groups = [],
            sign = reverseWinding ? -1 : 1;

        (paths || []).forEach((path) => {
            if (path.area * sign > 0) {
                groups.push([path]);
            } else if (path.area * sign < 0) {
                holes.push(path);
            } else {
                // Zero-area ring, skipping
            }
        });

        if (holes.length === 0) {
            return groups;
        }

        // Using a spatial index to improve performance when the current feature
        // contains many holes and space-filling rings.
        // (Thanks to @simonepri for providing an example implementation in PR #248)
        const ringIndex = require('rbush')(); // eslint-disable-line no-undef
        ringIndex.load(groups.map((group, i) => {
            const bounds = group[0].bounds;
            return {
                minX: bounds.xmin,
                minY: bounds.ymin,
                maxX: bounds.xmax,
                maxY: bounds.ymax,
                idx: i
            };
        }));

        // Group each hole with its containing ring
        holes.forEach((hole) => {
            let containerId = -1,
                containerArea = 0;
            const holeArea = hole.area * -sign,
                // Find rings that might contain this hole
                candidates = ringIndex.search({
                    minX: hole.bounds.xmin,
                    minY: hole.bounds.ymin,
                    maxX: hole.bounds.xmax,
                    maxY: hole.bounds.ymax
                });
            let ring, ringId, ringArea, isContained;
            // Group this hole with the smallest-area ring that contains it.
            // (Assumes that if a ring's bbox contains a hole, then the ring also
            //  contains the hole).
            for (let i = 0, n = candidates.length; i < n; i++) {
                ringId = candidates[i].idx;
                ring = groups[ringId][0];
                ringArea = ring.area * sign;
                isContained = ring.bounds.contains(hole.bounds) && ringArea > holeArea;
                if (isContained && (containerArea === 0 || ringArea < containerArea)) {
                    containerArea = ringArea;
                    containerId = ringId;
                }
            }
            if (containerId == -1) {
                debug("[groupPolygonRings()] polygon hole is missing a containing ring, dropping.");
            } else {
                groups[containerId].push(hole);
            }
        });

        return groups;
    };

    internal.getPathMetadata = function (shape, arcs, type) {
        const data = [];
        let ids;
        for (let i = 0, n = shape && shape.length; i < n; i++) {
            ids = shape[i];
            data.push({
                ids,
                area: type == 'polygon' ? geom.getPlanarPathArea(ids, arcs) : 0,
                bounds: arcs.getSimpleShapeBounds(ids)
            });
        }
        return data;
    };

    internal.quantizeArcs = function (arcs, quanta) {
        // Snap coordinates to a grid of @quanta locations on both axes
        // This may snap nearby points to the same coordinates.
        // Consider a cleanup pass to remove dupes, make sure collapsed arcs are
        //   removed on export.
        //
        const bb1 = arcs.getBounds(),
            bb2 = new Bounds(0, 0, quanta - 1, quanta - 1),
            fw = bb1.getTransform(bb2),
            inv = fw.invert();

        arcs.transformPoints((x, y) => {
            const p = fw.transform(x, y);
            return inv.transform(Math.round(p[0]), Math.round(p[1]));
        });
    };


    api.internal = internal;
    exportAPI = internal;
    //this.mapshaper = api;

// Expose internal objects for testing
    utils.extend(api.internal, {
        ArcCollection,
        ArcIter
    });

    if (typeof define === "function" && define.amd) { // eslint-disable-line no-undef
        //define("mapshaper", api);
        define([], () => exportAPI); // eslint-disable-line no-undef
    } else if (typeof module === "object" && module.exports) { // eslint-disable-line no-undef
        module.exports = exportAPI; // eslint-disable-line no-undef
    }
}());

export default exportAPI;
