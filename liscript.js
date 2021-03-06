LiScript = (function () {
  var slice = [].slice
  var translations = {
    // creates function objects
    // (fn (arg1 arg2 arg3) (+ arg1 arg2 arg3))
    // in JavaScript: function (arg1, arg2, arg3) {return arg1+arg2+arg3}
    'fun': function (argList,body) {
      if (arguments.length < 2) throw 'fun: invalid number of arguments'
      return '(function('+argList.join(',')+')'+
        '{'+slice.call(arguments,1,-1).map(tree_to_js).join(";")+
        ';return '+slice.call(arguments,-1).map(tree_to_js).join(",")+';})'
    },
    // creates a function with a unique default argument "_", intended for quick jobs
    // (lam (+ _ 1))
    'lam': function (body) {
      if (arguments.length < 1) throw 'lam: invalid number of arguments'
      return '(function(_)'+
        '{'+slice.call(arguments,0,-1).map(tree_to_js).join(";")+
        ';return '+slice.call(arguments,-1).map(tree_to_js).join(",")+';})'
    },
    // finish the actual functions run, returning a value
    // (ret 1)
    // this isn't a valid JavaScript expression, it does not return a value to its caller
    'ret': function (val) {
      //~ if (arguments.length != 1) throw 'ret: invalid number of arguments'
      return 'return ' + tree_to_js(val)
    },
    // instantiates a new object
    // (new MyClass 1 2 3)
    'new': function (class_name,construct_args) {
      if (arguments.length < 1) throw 'new: invalid number of arguments'
      return '(new ' +  arguments[0] + '(' + slice.call(arguments,1).map(tree_to_js).join(',') + '))'
    },
    // (if cond (case_true) (case_false))
    'if': function (cond,case_true,case_false) {
      if (arguments.length < 1) throw 'if: invalid number of arguments'
      return '('+tree_to_js(cond)+'?'+
        tree_to_js(case_true)+':'+
        (typeof(case_false)==='undefined'?null:tree_to_js(case_false))+')'
    },
    // for internal use
    // "Hello world"
    'str': function () {
      return '"'+slice.call(arguments).join(' ')+'"'
    },
    // for internal use
    // {a 1 b 2}
    // in JavaScript: {a:1, b:2}
    'obj': function (name,value) {
      if (arguments.length%2 != 0) throw 'obj: invalid number of arguments'
      for (var i=1, pairs=[]; i<arguments.length; i+=2)
        pairs.push([arguments[i-1],arguments[i]])
      return '({'+pairs.map(function (a) {return tree_to_js(a[0])+':'+tree_to_js(a[1])}).join(',')+'})'
    },
    // for internal use
    // [1 2 3]
    // in JavaScript: [1, 2, 3]
    'arr': function () {
      return '(['+slice.call(arguments).map(tree_to_js).join(',')+'])'
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
      return '('+tree_to_js(obj)+'['+slice.call(arguments,1).map(tree_to_js).join('][')+'])'
    },
    // define local scope variables (function scope)
    // (let a 1 b 2 c 3)
    // in JavaScript: var a=1, b=2, c=3
    // this isn't a valid JavaScript expression, it does not return a value to its caller
    'let': function (name,value) {
      if (arguments.length < 2 || arguments.length%2 != 0) throw 'let: invalid number of arguments'
      return translations['def'].apply(null,arguments)
        .replace(/^\(/g,'{var ')
        .replace(/\)$/g,'}')
    },
    // define global scope variables (or redefine values of already existent ones) inside a closure
    // (def a 1 b 2 c 3)
    // in JavaScript: a=1, b=2, c=3
    'def': function (name,value) {
      if (arguments.length < 2 || arguments.length%2 != 0) throw 'def: invalid number of arguments'
      if (arguments.length == 2) {
        return '('+tree_to_js(arguments[0])+'='+tree_to_js(arguments[1])+')'
      }
      for (var i=1, pairs=[]; i<arguments.length; i+=2)
        pairs.push([arguments[i-1],arguments[i]])
      return '(' + pairs.map(function (a) {return tree_to_js(a[0])+'='+tree_to_js(a[1])}).join(',')+')'
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
        return '(function(){'+
          'while('+tree_to_js(arguments[0])+')'+
          '{'+slice.call(arguments,1).map(tree_to_js).join(';')+'}})()'
      }
      return '(function(){'+
        tree_to_js(arguments[0])+
        ';while('+tree_to_js(arguments[1])+')'+
        '{'+slice.call(arguments,2).map(tree_to_js).join(';')+'}})()'
    },
    // iterates an object's members inside a closure
    // (iter [1 2 3] (def val (+ val 1)) (println val))
    // it binds the following variables locally:
    // obj_: the actual object passed to "iter"
    // key: the key of this member being accessed in the moment
    // val: the value of this same member
    'iter': function (obj,code) {
      if (arguments.length < 2) throw 'iter: invalid number of arguments'
      return '(function(obj_){'+
        'for(var key in obj_)'+
          '{var val=obj_[key];'+
          slice.call(arguments,1).map(tree_to_js).join(';')+
          '}})'+
        '('+tree_to_js(arguments[0])+')'
    },
    // runs a switch inside a closure
    // when a test pair matches, all commands are evaluated and the last value is returned
    // (switch abc
    //    (1 (something 1))
    //    (2 (something 2))
    //    ((something "default")) )
    // in JavaScript: switch(abc) {
    //    case 1: return something(1); break;
    //    case 2: return something(2); break;
    //    default: return something("default"); }
    'switch': function (value,tests_and_conditions) {
      var ret = '(function(_){switch(_){'
      for (var a = 1; a<arguments.length; a++) {
        if (a == arguments.length-1 && arguments[a].length == 1) {
          ret += 'default:return '+tree_to_js(arguments[a][0])
          break
        }
        if (arguments[a].length < 2) throw 'switch: invalid number of subarguments'
        ret += 'case '+tree_to_js(arguments[a][0])+':'+
          slice.call(arguments[a],1,-1).map(tree_to_js).join(';')+
          ';return '+slice.call(arguments[a],-1).map(tree_to_js)+
          ';break;'
      }
      ret += '}})('+tree_to_js(arguments[0])+')'
      return ret
    },
    // try multiple possibilities inside a closure
    // returns the expression associated with the sucessful test
    // the last body is optional, it's returned if all previous tests fail
    // (cond (test 1) (was 1)  (test 2) (was 2)  (was 0) )
    // in JavaScript:
    //    if (test(1)) {was(1)}
    //    else if (test(2)) {was(2)}
    //    else {was(0)}
    'cond': function () {
      if (arguments.length < 2) throw 'cond: invalid number of arguments'
      var ret = '(function(){if('+tree_to_js(arguments[0])+'){return '+tree_to_js(arguments[1])+'}'
      for (var a = 2; a<(arguments.length - (arguments.length%2)); a += 2) {
        ret += 'else if('+tree_to_js(arguments[a])+'){return '+tree_to_js(arguments[a+1])+'}'
      }
      if (arguments.length%2 == 1) {
        ret += 'return '+tree_to_js(arguments[arguments.length-1])
      } else {
        ret += 'return null'
      }
      ret += '})()'
      return ret
    },
    // calls a function returned by a function returned by a function...
    // (chain a [1 2 3] [4 5 6])
    // in JavaScript: a(1,2,3)(4,5,6)
    'chain': function (obj,values) {
      if (arguments.length < 2) throw 'chain: invalid number of arguments'
      return '('+tree_to_js(arguments[0])+
        '('+slice.call(arguments,1).map(tree_to_js)
          .map(function(a){
            if (a.match(/^\(\[|\]\)$/g) == null || a.match(/^\(\[|\]\)$/g).length != 2) {
              throw 'chain: invalid argument type'
            }
            return a.replace(/^\(\[|\]\)$/g,'')
          })
          .join(')(')+'))'
    },
    // execute as many commands as desired, inside a closure
    // intended to be used where only one command is permitted (as within "if" or "while")
    // (do (something 1) (something 2))
    // in JavaScript: something(1);something(2)
    'do': function () {
      if (arguments.length == 0)
        return ''
      return '(function(){'+
        slice.call(arguments,0,-1).map(tree_to_js).join(";")+
        ';return '+slice.call(arguments,-1).map(tree_to_js).join(",")+
        '})()'
    },
    // execute as many commands as desired, inside a closure, always return null
    // intended to be used where only one command is permitted (as within "if" or "while")
    // (void (something 1) (something 2))
    'void': function () {
      if (arguments.length == 0)
        return ''
      return '(function(){'+
        slice.call(arguments).map(tree_to_js).join(";")+
        ';return null})()'
    },
    // try to run a piece of code in a closure
    // in case of exception it runs "catch" body, and always runs "finally" body
    // the "finally" body argument is optional
    // if you include a "finally" argument, the last value will be returned
    // you must pass the commands inside parenthesis pairs (syntax similar with "switch"'s one)
    // (try
    //  ( (something 1)(something 2) )
    //  ( (error _) )
    //  ( (finally 1)(finally 2) ) )
    // in JavaScript: try { something(1);something(2); } catch (_) { error(_) } finally { finally(1);finally(2); }
    'try': function (try_body,catch_body,finally_body) {
      if (arguments.length < 2 || arguments.length > 3) throw 'try: invalid number of arguments'
      ret = '(function(){try{'+
        slice.call(arguments[0],0,-1).map(tree_to_js).join(';')+
        ';return '+slice.call(arguments[0],-1).map(tree_to_js)+
        '}catch(_){'
      if (arguments.length == 3) {
        ret +=
          slice.call(arguments[1]).map(tree_to_js).join(';')+
          '}finally{'+
          slice.call(arguments[2],0,-1).map(tree_to_js).join(';')+
          ';return '+slice.call(arguments[2],-1).map(tree_to_js)
      } else {
        ret += slice.call(arguments[1],0,-1).map(tree_to_js).join(';')+
          ';return '+slice.call(arguments[1],-1).map(tree_to_js)
      }
      ret += '}})()'
      return ret
    },
    // throws an exception
    // this isn't a valid JavaScript expression, it does not return a value to its caller
    'throw': function () {
      if (arguments.length != 1) throw 'throw: invalid number of arguments'
      return '{throw '+tree_to_js(arguments[0])+'}'
    },
    // discards its operands, do nothing
    'nop': function () {
      return ''
    },
    // JavaScript's "instanceof" operator adapted to s-expr syntax
    'instanceof': function () {
      if (arguments.length != 2) throw 'instanceof: invalid number of arguments'
      return '('+tree_to_js(arguments[0])+' instanceof '+tree_to_js(arguments[1])+')'
    },
    // permits using fluent interfaces, or dot-syntax deep objects access
    // (. "12345" (replace "1" "9") (replace "3" "7") )
    // in JavaScript: "12345".replace("1","9").replace("3","7")
    '.': function () {
      if (arguments.length < 2) throw '.: invalid number of arguments'
      return '('+tree_to_js(arguments[0])+'.'+
        slice.call(arguments,1).map(tree_to_js)
        .map(function (a) {return a.replace(/^\(|\)$/g,'')})
        .join('.')+')'
    },
    // inverts a value signal
    // (neg 1)
    // in JavaScript: -(1)
    'neg': function (val) {
      if (arguments.length != 1) throw 'neg: invalid number of arguments'
      return '-' + tree_to_js(arguments[0])
    },
  }
  // infix operators
  var operators = {
    'and':'&&',
    'or':'||',
    '=':'==',
    'same':'===',
    '!=':'!=',

    '+':'+',
    '-':'-',
    '*':'*',
    '/':'/',
    '%':'%',

    // You shouldn't use these with more than 2 elements, it's a JavaScript syntax violation
    '+=':'+=',
    '-=':'-=',
    '*=':'*=',
    '/=':'/=',
    '%=':'%=',

    '<':'<',
    '>':'>',
    '<=':'<=',
    '>=':'>=',

    '<<':'<<',
    '>>':'>>',
    '>>>':'>>>',
    '&':'&',
    '|':'|',
    '^':'^',

    // I've realized, you can call "(~ 1)" or "(!! 1)", we don't need convenience functions for this
  }
  for (var op in operators) {(function (op) {
    translations[op] = function () {
      return '('+slice.call(arguments).map(tree_to_js).join(operators[op])+')'
    };
  })(op)}
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
        if (symbol.length>0)
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
    var ret = parse_tree("("+
      text
        // Lines having a commentary mustn't contain code behind
        .replace(/^[\s]*;([^\n]*)$/mg,"")
        .replace(/[\n\t]/g," ")
    +")")
      .map(function (ast) {
        return tree_to_js(ast);
      })
      .join(";")
      .replace(/[;]{2,}/g,';')
    return ret
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
