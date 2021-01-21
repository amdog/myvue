window.Vue = function(options) {
    this._init(options)
    return
}

Vue.prototype._init = function(ops) {
    this.$options = ops
    initstate(this)
    if (ops.ele) {
        this.$mount(ops)
    }
}

function query(el) {
    if (typeof el == 'string') {
        return document.querySelector(el)
    } else {
        return {}
    }
}

Vue.prototype.$mount = function(ops) {
    let vm = this
    this.$el = query(ops.ele);
    new Watcher(this, function() {
        vm._update()
    })
}
Vue.prototype._update = function() {
    let node = document.createDocumentFragment()
    let firstChild;
    let ele = this.$el
    while (firstChild = ele.firstChild) {
        node.appendChild(firstChild)
    }
    compiler(node, this)
        // 此时已经 ele 已经没有子元素了
    ele.appendChild(node)

}

function compiler(node, vm) {
    let childNodes = node.childNodes;
    [...childNodes].forEach(function(e) {
        if (e.nodeType === 1) {
            compiler(e, vm)
        } else if (e.nodeType === 3) {
            compilertext(vm, e)
        }
    });
}

let WATCHER
let DEPID = 0
let WATCHERID = 0


Vue.prototype.$watch = function(key, handler) {
    new Watcher(this, key, handler, {
        user: true
    })
}

function Watcher(vm, updatefun, cb, ops) {
    this.id = WATCHERID++
        this.deps = []
    this.depsId = new Set()

    if (typeof updatefun == 'function') {
        this.run = updatefun
        this._update = function() {
            queuewatcher(this)
        }
    } else {
        let old = getv(vm, `return vm.${updatefun}`)
        this.run = function() {
            vm._update()
        }
        this._update = function() {
            queuewatcher(this)
            if (cb) {
                let newv = getv(vm, `return vm.${updatefun}`)
                if (newv !== old) {
                    cb(old, newv)
                }
            }
        }
    }
    WATCHER = this
    this._update();
}

let HAS = {}
let QUEUE = []

function flusqueue() {
    QUEUE.forEach(function(v) {
        v.run()
    })
    HAS = {}
    QUEUE = []
}

function queuewatcher(watcher) {
    if (!HAS[watcher.id]) {
        HAS[watcher.id] = true
        QUEUE.push(watcher)
    }
    nexttrik(flusqueue)
}

function nexttrik(flusqueue) {
    Promise.resolve().then(flusqueue)
}

Watcher.prototype.adddep = function(dep) {
    if (!this.depsId.has(dep.id)) {
        this.depsId.add(dep.id)
        this.deps.push(dep)
    }
}

function Dep() {
    this.id = DEPID++
        this.subs = []
}

Dep.prototype.addsub = function(watcher) {
    this.subs.push(watcher)
}

Dep.prototype.depend = function() {
    this.addsub(WATCHER)
    WATCHER.adddep(this)
}

Dep.prototype.notify = function() {
    this.subs.forEach(function(v) {
        v._update();
    })
    return
}

function getv(vm, fnContent) {
    let getv_ = new Function('vm', fnContent)
    return getv_(vm)
}

function compilertext(vm, e) {
    if (!e.expr) {
        e.expr = e.textContent
    }
    const rexp = /\{\{((?:.|\r?\n)+?)\}\}/g;
    e.textContent = e.expr.replace(rexp, function(...args) {
        let v = getv(vm, `return vm.${args[1]}`)
        return v
    })
}

function initstate(vm) {
    let opts = vm.$options
    if (opts.data) {
        initdata(vm)
    }
    if (opts.computed) {
        initcomputed(vm)
    }
    if (opts.watch) {
        initwatch(vm)
    }
}

function initwatch(vm) {
    for (let key in vm.$options.watch) {
        vm.$watch(key, vm.$options.watch[key])
    }
}

function initcomputed(vm) {

    for (let key in vm.$options.computed) {
        Object.defineProperty(vm, key, {
            get() {
                vm._update()
                return vm.$options.computed[key].call(vm)
            }
        })
    }
}

function initdata(vm) {
    let data = vm.$options.data
    if (typeof data == 'function') {
        //data里面的this指向vm实例 this.xxx=xx
        vm._data = data.call(vm)
    } else {
        vm._data = data || {}
    }
    for (let k in vm._data) {
        proxy(vm, '_data', k)
    }
    observe(vm._data)
}


function proxy(vm, source, k) {
    Object.defineProperty(vm, k, {
        set(newv) {
            return vm[source][k] = newv
        },
        get() {
            return vm[source][k]
        }
    })
}

function observe(data) {
    if (typeof data !== 'object' || data == null) {
        return
    }
    if (data.__ob__) {
        return data
    }
    return new Observer(data)
}

function Observer(data) {
    this.dep = new Dep()
    let keys = Object.keys(data)

    Object.defineProperty(data, '__ob__', {
        get: () => {
            return this
        }
    })

    if (Array.isArray(data)) {
        data.__proto__ = arrayMethods
        observearray(data)
    }
    keys.forEach(function(v) {
        reactive(data, v, data[v]);
    })
}

function dependarray(value) {
    for (let i = 0; i < value.length; i++) {
        let item = value[i];
        item.__ob__ && item.__ob__.dep.depend()
        if (Array.isArray(item)) {
            dependarray()
        }
    }
}

function reactive(d, k, v) {
    let ob = observe(v)
    let dep = new Dep()
        //Object.defineProperty(倾听的数据，倾听的键，配置{get,set})
    Object.defineProperty(d, k, {
        get() {
            if (WATCHER) {
                dep.depend()
                if (ob) {
                    ob.dep.depend()
                    dependarray(v)
                }
            }
            return v
        },
        set(newv) {
            if (newv === v) {
                return
            }
            v = newv
            observe(newv)
            dep.notify();
        }
    })

}

function observearray(args) {
    args.forEach(function(v) {
        observe(v)
    })
} //数组拦截

var oldMethods = Array.prototype
var arrayMethods = Object.create(oldMethods)
var methods = ['pop', 'push', 'shift', 'unshift', 'sort', 'splice', 'reverse'];
methods.forEach(function(method) {
    arrayMethods[method] = function(...args) {
        if (args.length > 0) {
            observearray(args)
        }
        let result = oldMethods[method].apply(this, args)
        this.__ob__.dep.notify()
        return result
    }
})