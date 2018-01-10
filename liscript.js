LiScript = (function () {
  var slice = [].slice;
  var translations = {
    // creates function objects
    // (fn (arg1 arg2 arg3) (+ arg1 arg2 arg3))
    // in JavaScript: function (arg1, arg2, arg3) {return arg1+arg2+arg3}
    'fun': function (argList,body) {
      if (arguments.length < 2) throw 'fun: invalid number of arguments'
      return '(function ('+argList.join(',')+')'+
        '{'+slice.call(arguments,1,-1).map(tree_to_js).join(";")+
        ';return '+slice.call(arguments,-1).map(tree_to_js).join(",")+';})';
    },
    // finish the actual functions run, returning a value
    // (ret 1)
    // this isn't a valid JavaScript expression, it does not return a value to its caller
    'ret': function (val) {
      if (arguments.length != 1) throw 'ret: invalid number of arguments'
      return 'return ' + tree_to_js(val)
    },
    // instantiates a new object
    // (new MyClass 1 2 3)
    'new': function (class_name,construct_args) {
      if (arguments.length < 1) throw 'new: invalid number of arguments'
      return '(new ' +  arguments[0] + '(' + slice.call(arguments,1).map(tree_to_js).join(',') + '))'
    },
    // creates a function with a unique default argument "_", intended for quick jobs
    // (lam (+ _ 1))
    'lam': function (body) {
      if (arguments.length < 1) throw 'lam: invalid number of arguments'
      return '(function (_)'+
        '{'+slice.call(arguments,0,-1).map(tree_to_js).join(";")+
        ';return '+slice.call(arguments,-1).map(tree_to_js).join(",")+';})';
    },
    // (if cond (case_true) (case_false))
    'if': function (cond,case_true,case_false) {
      if (arguments.length < 1) throw 'if: invalid number of arguments'
      return '('+tree_to_js(cond)+'?'+tree_to_js(case_true)+':'+tree_to_js(case_false)+')';
    },
    // coalesce terms into a string
    // (str word1 word2 word3 word4)
    // in JavaScript: "word1 word2 word3 word4"
    // if you want to apply "str" over regular objects, use "call"...
    'str': function () {
      return '"'+slice.call(arguments).join(' ')+'"';
    },
    // {a 1 b 2}
    // in JavaScript: {a:1, b:2}
    'obj': function (name,value) {
      if (arguments.length%2 != 0) throw 'obj: invalid number of arguments'
      for (var i=1, pairs=[]; i<arguments.length; i+=2)
        pairs.push([arguments[i-1],arguments[i]]);
      return '({'+pairs.map(function (a) {return '"'+a[0]+'":'+tree_to_js(a[1])}).join(',')+'})';
    },
    // [1 2 3]
    // in JavaScript: [1, 2, 3]
    'arr': function () {
      return '(['+slice.call(arguments).map(tree_to_js).join(',')+'])';
    },
    // permits to set a value into a deep object
    // (set a "b" "c" 3)
    // in JavaScript: a["b"]["c"]=3
    'set': function (obj,key,val) {
      if (arguments.length < 3) throw 'set: invalid number of arguments'
      return '('+tree_to_js(arguments[0])+
        '['+slice.call(arguments,1,-1).map(tree_to_js).join('][')+']'+
        '='+slice.call(arguments,-1).map(tree_to_js)+')'
    },
    // (get a "b" "c")
    // in JavaScript: a["b"]["c"]
    'get': function (obj,key) {
      if (arguments.length < 2) throw 'get: invalid number of arguments'
      return '('+tree_to_js(obj)+'['+slice.call(arguments,1).map(tree_to_js).join('][')+'])';
    },
    // define local scope variables (function scope)
    // (let a 1 b 2 c 3)
    // in JavaScript: var a=1, b=2, c=3
    // this isn't a valid JavaScript expression, it does not return a value to its caller
    'let': function (name,value) {
      if (arguments.length < 2 || arguments.length%2 != 0) throw 'let: invalid number of arguments';
      for (var i=1, pairs=[]; i<arguments.length; i+=2)
        pairs.push([arguments[i-1],arguments[i]]);
      return '{var ' + pairs.map(function (a) {return a[0]+'='+tree_to_js(a[1])}).join(',')+'}'
    },
    // define global scope variables
    // (def a 1 b 2 c 3)
    // in JavaScript: a=1; b=2; c=3
    // this isn't a valid JavaScript expression, it does not return a value to its caller
    'def': function (name,value) {
      if (arguments.length < 2 || arguments.length%2 != 0) throw 'def: invalid number of arguments';
      for (var i=1, pairs=[]; i<arguments.length; i+=2)
        pairs.push([arguments[i-1],arguments[i]]);
      return '{' + pairs.map(function (a) {return a[0]+'='+tree_to_js(a[1])}).join(',')+'}'
    },
    // runs a while-loop inside a closure
    // (while (let a 1) (< a 10) (console.log a) (def a (+ a 1)) )
    // first argument (optional) is the preset instructions body, it runs before the actual loop
    // second is the loop control
    // third and forward are the loop body
    // if you don't provide a preset body, "while" will expect a loop control and body
    'while': function (preset,cond,body) {
      if (arguments.length < 2) throw 'while: invalid number of arguments'
      if (arguments.length == 2) {
        return '(function () {'+
          'while('+tree_to_js(arguments[0])+')'+
          '{'+slice.call(arguments,1).map(tree_to_js).join(';')+'}})()';
      }
      return '(function () {'+
        tree_to_js(arguments[0])+
        ';while('+tree_to_js(arguments[1])+')'+
        '{'+slice.call(arguments,2).map(tree_to_js).join(';')+'}})()';
    },
    // iterates an object's members inside a closure
    // (iter [1 2 3] (def val (+ val 1)) (println val))
    // it binds the following variables locally:
    // obj_: the actual object passed to "iter"
    // key: the key of this member being accessed in the moment
    // val: the value of this same member
    'iter': function (obj,code) {
      if (arguments.length < 2) throw 'iter: invalid number of arguments'
      return '(function (obj_) {'+
        'for(var key in obj_)'+
          '{var val=obj_[key];'+
          slice.call(arguments,1).map(tree_to_js).join(';')+
          '}})'+
        '('+tree_to_js(arguments[0])+')'
    },
    // calls a function (can be a deep object), passing (preferably) a array as its arguments
    // (call a "b" "c" [1 2 3])
    // in JavaScript: a["b"]["c"].apply(this,[1,2,3])
    // in JavaScript: a["b"]["c"](1,2,3) // equivalent in this case
    'call': function (obj,method,args) {
      if (arguments.length < 2) throw 'call: invalid number of arguments'
      if (arguments.length == 2) {
        return '('+tree_to_js(arguments[0])+
          '.apply(this,'+slice.call(arguments,-1).map(tree_to_js)+'))';
      }
      return '('+tree_to_js(arguments[0])+
        '['+slice.call(arguments,1,-1).map(tree_to_js).join('][')+']'+
        '.apply(this,'+slice.call(arguments,-1).map(tree_to_js)+'))';
    },
    // execute as many commands as desired, (possibly) inside a closure
    // intended to be used where only one command is permitted (as within "if" or "while")
    // (do (something 1) (something 2))
    // in JavaScript: something(1);something(2)
    'do': function () {
      if (arguments.length == 0)
        return ''
      if (arguments.length == 1)
        return '('+tree_to_js(arguments[0])+')'
      return '(function(){'+
        slice.call(arguments,0,-1).map(tree_to_js).join(";")+
        ';return '+slice.call(arguments,-1).map(tree_to_js).join(",")+
        '})()';
    },
    // permits using fluent interfaces, or dot-syntax deep objects access
    // (. "12345" (replace "1" "9") (replace "3" "7") )
    // in JavaScript: "12345".replace("1","9").replace("3","7")
    '.': function () {
      if (arguments.length < 2) throw '.: invalid number of arguments'
      return '('+tree_to_js(arguments[0])+'.'+
        slice.call(arguments,1).map(tree_to_js)
        .map(function (a) {return a.replace(/^\(|\)$/g,'')})
        .join('.')+')';
    },
  };
  // infix operators
  var operators = {
    'and':'&&',
    'or':'||',
    '=':'==',
    '!=':'!=',
    '+':'+',
    '-':'-',
    '*':'*',
    '/':'/',
    '%':'%',
    '<':'<',
    '>':'>',
    '<=':'<=',
    '>=':'>='
  };
  for (var op in operators) {(function (op) {
    translations[op] = function () {
      return '('+slice.call(arguments).map(tree_to_js).join(operators[op])+')';
    };
  })(op)};
  var macros = {
    defmacro: function (name,args,body) {
      return eval(tree_to_js(['LiScript.add_macro',['str',name],['fn',args,body]])), '"macro"';
    },
    defreader: function (head,open,close) {
      return eval(tree_to_js(['LiScript.add_reader',['str',head],['str',open],['str',close]])), '"reader"';
    }
  };
  var add_macro = function (name,fn) { console.log("adding macro ",name,fn); macros[name]=fn; };
  var readers = {
    '(':{close:')'},
    '"':{close:'"',head:'str'},
    "[":{close:"]",head:'arr'},
    "{":{close:"}",head:'obj'},
  };
  var add_reader = function (head,open,close) { readers[open] = {close:close,head:head}; console.log(readers); };
  var parse_tree = function (str) {
    return (function parse_object(close) {
      var obj=[], symbol="", reader;
      function push_symbol() {
        if (symbol.length>0 && symbol!=" ")
          obj.push(symbol);
        symbol='';
      };
      function matchingReader(str) {
        for (var reader in readers) {
          if (str.slice(0,reader.length)==reader)
            return {open:reader,close:readers[reader].close,head:readers[reader].head};
        }
      };
      for (; str.length>0; str=str.slice(1)) {
        if (str[0]==close) break;
        if (close != '"') {
          if ( (reader = matchingReader(str)) ) {
            push_symbol()
            str=str.slice(reader.open.length)
            obj.push((reader.head?[reader.head]:[]).concat(parse_object(reader.close)));
          } else if (str[0]==' ') push_symbol();
          else symbol+=str[0];
        }
        else symbol+=str[0];
      };
      push_symbol();
      return obj;
    })()[0];
  };
  var tree_to_string = function (ast) {
    return typeof(ast) != "object" ? ast : "("+ast.map(tree_to_string).join(" ")+")";
  };
  var tree_to_js = function (ast) {
    return typeof(ast)!='object' ? ast
      : macros[ast[0]] ? tree_to_js(macros[ast[0]].apply(this,ast.slice(1)))
      : translations[ast[0]] ? translations[ast[0]].apply(this,ast.slice(1))
      : '('+tree_to_js(ast[0])+'('+ast.slice(1).map(function (a) {return tree_to_js(a);}).join(',')+'))';
  };
  var compile = function (text) {
    return parse_tree("("+text.replace(/[\n\t]/g,"")+")")
      .map(function (ast) {
        //~ return tree_to_js(parse_tree(tree_to_string(ast)));
        return tree_to_js(ast);
      })
      .join(";");
  };
  var evaluate = function (text) {
    return eval(compile(text));
  };
  return {
    'eval':evaluate,
    'compile':compile,
    'add_macro':add_macro,
    'add_reader':add_reader,
    'parse_tree':parse_tree,
    'tree_to_js':tree_to_js,
    'tree_to_string':tree_to_string
  };
})();
