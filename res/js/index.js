/* add wave effect for click */
var $      = document.getElementById.bind(document),
  shadow = $('shadow');
Waves.init();
Waves.attach(document.getElementsByTagName('header')[0], 'waves-block', true);
Waves.attach(shadow, null, true);

chrome.tabs ? chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  var tabId = tabs[0].id,
    bg = chrome.extension.getBackgroundPage();
  createView(document, bg, tabId);
}) : document.write('<script src="./js/test.js" onload="createView(document)"></script>');

/* 生成DOM */
function createView(document, bg, tabId, undefined){
  /* 支持 插件模式 或 预览模式 */
  var messages,
    allListeners,
    timer,
    highlightTimer,
    main      = $('main'),
    container = $('container'),
    listenerContainer = $('listener'),
    navTabs   = document.querySelector('.nav-tabs'),
    settingsContent = $('settingsContent'),
    listenerLinks    = [],
    listenerLinkDOMs = [];

  /* 扩展HTML prototype */
  extendHTML();

  /* 绑定more按钮点击事件 */
  $('more').addEventListener('click', function(){
    var confirmBtn = $('confirmProxyBtn');
    /* 加载代理规则 */
    if(bg) {
      confirmBtn.disabled = true;
      [].forEach.call(document.querySelectorAll('.proxy-item:not(.display-none)'), function(item){
        item.parentNode.removeChild(item);
      });
      // 加载之前的代理内容
      var map = bg.getProxyMap();
      Object.keys(map).forEach(function (key) {
        var item = document.querySelector('.proxy-item').cloneNode(true);
        var inputs = item.querySelectorAll('input');
        inputs[0].value = key;
        inputs[0].defaultValue = key;
        inputs[1].value = map[key];
        inputs[1].defaultValue = map[key];
        setTimeout(function () {
          settingsContent.appendChild(item.removeClass('display-none'));
        }, 0);
      });
      /* 是否启用proxy */
      $('proxySwitch').checked = localStorage.getItem('proxySwitch') === 'true';
      $('proxySwitch').addEventListener('click', function(){
        bg.toggleProxy(this.checked);
        localStorage.setItem('proxySwitch', this.checked);
      });
    }
    if(!this.Clicked){
      this.Clicked = true;
      /* 保存代理规则 */
      bg && confirmBtn.addEventListener('click', function(){
        /* 获取所有的proxy规则 */
        var map = [].reduce.call(settingsContent.querySelectorAll('.proxy-item:not(.display-none)'), function(p, item){
          item.removeClass('add');
          var inputs = item.querySelectorAll('input');
          p[inputs[0].value] = inputs[1].value;
          return p;
        }, {});
        bg.setProxyMap(map);
        bg.isProxyOn && bg.updateProxy();
        this.disabled = true;
        [].forEach.call(settingsContent.querySelectorAll('.edit'), function(item){
          item.defaultValue = item.value;
          item.removeClass('edit');
        });
        showToast(document.body, '更新成功');
      });
      /* 关闭设置对话框 */
      $('settingsCloseBtn').addEventListener('click', toggleSettingDialog);
      /* 点击清除shadow background */
      $('bg-shadow').addEventListener('click', toggleSettingDialog);
      /* 新增代理规则 */
      $('addProxyBtn').addEventListener('click', function(){
        var item = document.querySelector('.proxy-item').cloneNode(true);
        settingsContent.appendChild(item.removeClass('display-none').addClass('add'));
      });
      /* 移除代理规则 */
      settingsContent.on('.icon-remove', 'click', function(){
        var item = this.parentNode;
        item.parentNode.removeChild(item);
        !item.hasClass('add') && (confirmBtn.disabled = false);
      });
      /* 编辑后高亮 */
      settingsContent.on('input', 'input', throttle(function(){
        if(this.defaultValue !== this.value){
          !this.hasClass('edit') && this.addClass('edit');
        }else{
          this.hasClass('edit') && this.removeClass('edit');
        }
        confirmBtn.disabled = false;
      }, 200));
    }
    toggleSettingDialog();
  });

  /* 绑定tab栏点击事件 */
  [].forEach.call(document.querySelectorAll('.nav-tabs a'), function(tab){
    tab.addEventListener('click', function(){
      if(!this.parentNode.hasClass('active')){
        navTabs.querySelector('.active').removeClass('active');
        this.parentNode.addClass('active');
        document.body.toggleClass('tab-toggle');
        /* create all listener */
        if(this.getAttribute('data-href') === 'listener'){
          createAllListeners();
        }
      }
    });
  });

  if(bg && tabId){
    if(!bg.getPageListenerStatus(tabId)){
      setTips('本页面尚未开启Header监听...', container);
      return;
    }
    messages = bg.getMessages(tabId);
  }else{
    messages = window.messages;
  }
  if(!messages || isEmptyObject(messages)){
    setTips('监听已开启，请耐心等待消息的到来...', container);
    return;
  }

  /* 声明变量 */
  var links         = [],
      linkDOMs      = [],
      changelist    = {},
      headers       = $('headers'),
      globalSwitch  = $('globalSwitch'),
      saveBtn       = createSaveButton($('menu'), bg),
      table         = createNode('table'),
      tr            = createNode('tr', table);

  /* 创建表头 */
  table.className = 'hand';
  createNode('th', tr, 'Num');
  createNode('th', tr, 'Request URL');
  createNode('th', tr, 'Method');
  createNode('th', tr, 'Status');
  createNode('th', tr, 'Time(ms)');

  /* 循环取出消息 */
  for(var key in messages){
    if(messages.hasOwnProperty(key)){
      var item      = messages[key],
        request   = item.request,
        response  = item.response,
        complete  = item.complete;

      /* 请求头未来得及监听的不展示 */
      if(!request){
        continue;
      }

      tr = createNode('tr', table);
      links.push(request.url.toLowerCase());

      /* 展示请求信息 */
      tr.setAttribute('data-i', request.requestId);
      createNode('td', tr).addClass('counter');
      var div = createNode('div', createNode('td', tr), request.url);
      div.setAttribute('title', request.url);
      linkDOMs.push({parent: tr, child: div, url: request.url});
      createNode('td', tr, request.method);
      createNode('td', tr, response ? response.statusCode : '-').className = 'status';

      var startTime = response ? ~~(response.timeStamp - request.timeStamp) : '响应未达',
        finishTime = complete ? ~~(complete.timeStamp - request.timeStamp) : '未完成';
      createNode('td', tr, startTime + '/' + finishTime);

      var trNext = createNode('tr', table).addClass('header-box').addClass('display-none');
      createNode('td', trNext).addClass('headers').setAttribute('colspan', 6);

      /* add click event for tr */
      listenClick(tr, messages, function(parent, data){
        var requestHeaders = data.request.requestHeaders,
          response       = data.response;

        createHeaders('request', parent, requestHeaders);
        response && createHeaders('response', parent, response.responseHeaders);
      });
      addWaveEffect(tr, shadow);
    }
  }
  createNode('div', container).addClass('table-box').appendChild(table);
  /* 初始化 */
  listenSearch($('search').removeClass('display-none'));

  var preserveLogStatus = bg && bg.getPreserveLog(tabId),
    logCheckbox = $('preserve_log');
  preserveLogStatus && logCheckbox.addClass('checked');
  listenLog(logCheckbox);
  listenGlobalSwitch(globalSwitch);
  listenClear($('clear'));
  $('menu').removeClass('display-none');

  /* 创建DOM节点 */
  function createNode(type, parent, value){
    var e = document.createElement(type);
    parent && parent.appendChild(e);
    value !== undefined && (e.innerText = value);
    return e;
  }

  /* 监听tr的click */
  function listenClick(element, data, fn){
    var parent = element.parentNode;
    element.addEventListener('click', function(){
      var i = this.getAttribute('data-i');

      if(this.hasClass('selected')){
        this.next().toggleClass('display-none');
      }else{
        /* 去掉上一次的选中元素 */
        var beforeSelected = parent.querySelector('.selected');
        if(beforeSelected){
          beforeSelected.removeClass('selected');
          beforeSelected.next().addClass('display-none');
        }
        this.addClass('selected');
        this.next().removeClass('display-none');
      }
      if(!this.created){
        /* 生成headers表单 */
        this.created = true;

        var headerTable    = this.next().querySelector('td'),
          table          = createNode('table');
        fn(table, data[i]);
        headerTable.appendChild(table);
      }
    });
  }

  /* 创建headers部分 */
  function createHeaders(type, parent, data){
    /* 按照name进行排序 */
    data.sorted || data.sort(function(a, b){
      return a.name > b.name;
    }) && (data.sorted = true);

    var types = {request: 'Request Headers', response: 'Response Headers'},
      tr = createNode('tr', parent).addClass('title'),
      th = createNode('th', tr, types[type]);

    th.setAttribute('colspan', 2);

    /* 生成headers map列表 */
    for(var k = 0; k < data.length; k++){
      var item   = data[k],
        tr     = createNode('tr', parent),
        keyDiv = createNode('div', createNode('td', tr), item.name),
        td     = createNode('td', tr),
        headerValue = createNode('div', td, item.value).addClass('edit-header');

      td.addClass('edit-model');
      k === data.length - 1 && createNode('span', keyDiv).addClass('add-btn icon-plus icon').addEventListener('click', function(){
        addHeader(type, tr, saveBtn);
      });
      headerValue.setAttribute('contentEditable','');
      headerValue.setAttribute('data-key', item.name);
      headerValue.setAttribute('spellcheck', false);
      headerValue.defaultValue = item.value;

      /* headerValue输入时，高亮当前区域、并切换按钮状态 */
      listenChange(type, headerValue, parent, saveBtn);
      var removeBtn = createNode('a', td);
      removeBtn.addClass('icon-remove icon');
      listenRemove(type, removeBtn, item.name, true, tr, saveBtn);
    }
  }

  /* 创建保存按钮 */
  function createSaveButton(parent, bgContext){
    var input = document.createElement('input');
    input.type = 'button';
    input.className = 'icon-ok icon btn';
    input.disabled = true;
    input.addEventListener('click', function(){
      if(bgContext){
        if(!isEmptyObject(changelist)){
          var _tabId = globalSwitch.hasClass('checked') ? 'all' : tabId;
          changelist.request && bgContext.setModifyHeadersListener('requestHeaders', _tabId, changelist.request);
          changelist.response && bgContext.setModifyHeadersListener('responseHeaders', _tabId, changelist.response);
          changelist = {};
          /* 保存后清除输入框的状态 */
          [].forEach.call(container.querySelectorAll('.modified'), function(item){
            item.defaultValue = item.innerText;
            item.removeClass('modified');
          });
          input.disabled = true;
          showToast(container, 'success');
        }
      }else{
        console.warn('预览模式下无法修改header...');
        showToast(main, '预览模式下无法修改header...');
      }
    });
    //parent.appendChild(input);
    parent.insertBefore(input, globalSwitch);
    return input;
  }

  /* 新增header */
  function addHeader(type, tr, input){
    var newTR = createNode('tr').addClass('add-model');
    var headerName = createNode('div', createNode('td', newTR));
    headerName.setAttribute('contentEditable','');
    var td = createNode('td', newTR).addClass('edit-model');
    var div = createNode('div', td).addClass('edit-header');
    div.setAttribute('contentEditable','');
    var a = createNode('a', td);

    /* 确认添加header */
    createNode('span', a, 'Ok').addClass('ok').addEventListener('click', function(){
      if(headerName.innerText.trim() === ''){
        /* 错误提示 */
        showToast(main, 'header名称不能为空!');
        function flash(){
          highlightTimer && window.clearTimeout(highlightTimer);
          headerName.toggleClass('error');
          if(headerName.innerText){
            headerName.removeClass('error');
          }else{
            highlightTimer = setTimeout(flash, 500);
          }
        }
        flash();
      }else{
        /* 切换新增状态为编辑状态 */
        var url = document.querySelector('.selected div').innerText;
        addChangeItem(type, url, headerName.innerText, div.innerText);
        newTR.removeClass('add-model');
        headerName.removeAttribute('contentEditable');
        a.innerText = '';
        a.addClass('icon-remove icon');
        input.disabled = false;
        listenChange(type, div, newTR.parentNode, input);
        setTimeout(function(){
          listenRemove(type, a, headerName.innerText, false, newTR, input);
        }, 0);
      }
    });
    createNode('span', a, ' or ');

    /* 取消添加header */
    createNode('span', a, 'Cancel').addClass('cancel').addEventListener('click', function(){
      newTR.parentNode.removeChild(newTR);
    });
    var nextNode = tr.next();
    nextNode ? tr.parentNode.insertBefore(newTR, nextNode) : tr.parentNode.appendChild(newTR);
  }

  /* 创建所有监听列表 */
  function createAllListeners(){
    allListeners = bg && bg.getAllPageListeners();
    var k,
      headerData = {};

    /* 格式化数据 */
    if(allListeners) {
      for (k in allListeners) {
        allListeners.hasOwnProperty(k) && formatData(allListeners[k], ['onBeforeSendHeaders', 'onHeadersReceived'], headerData);
      }
    }else{
      headerData = window.headerData;
    }
    if(isEmptyObject(headerData)){
      if(!listenerContainer.querySelector('.tips')){
        listenerContainer.innerHTML = '';
        setTips('还没有修改header的监听...', listenerContainer);
      }
      return;
    }
    if(window.beforeHeaderData && (JSON.stringify(headerData) === JSON.stringify(window.beforeHeaderData))){
      return;
    }
    window.beforeHeaderData = headerData;
    createListenerTable(headerData);
  }

  /**/
  function formatData(pageListener, nameList, headerData){
    nameList.forEach(function(name){
      var listener = pageListener.listeners[name],
        currentChangelist,
        types = {
          onBeforeSendHeaders: 'request',
          onHeadersReceived: 'response'
        };

      if(listener && (currentChangelist = listener.changelist)){
        var urls = Object.keys(currentChangelist);
        urls.forEach(function (url) {
          var urlObject = currentChangelist[url],
            keys = Object.keys(urlObject),
            item = headerData[url];
          item = item || {
              url: url,
              tabId: pageListener.tabId,
              headers: [],
              changelistArray: [],
            };

          keys.forEach(function (key) {
            var header = {
              key: key,
              type: types[name],
              source: urlObject,
              value: urlObject[key]
            };
            item.headers.push(header);
          });

          item.changelistArray.push(currentChangelist);

          headerData[url] = item;
        });
      }
    });
  }

  /* 创建 table */
  function createListenerTable(headerData){
    listenerContainer.innerHTML = '';
    var table = createNode('table', createNode('div', listenerContainer).addClass('table-box')).addClass('hand'),
        tr    = createNode('tr', table);

    table.id = 'allListener';
    /* 创建表头 */
    createNode('th', tr, 'Num');
    createNode('th', tr, 'TabId');
    createNode('th', tr, 'Request URL');

    Object.keys(headerData).forEach(function(url){
      var item = headerData[url];
      /* 创建 row */
      var tr = createNode('tr', table);
      tr.setAttribute('data-i', url);
      createNode('td', tr).addClass('counter');
      createNode('td', tr, item.tabId);
      var td = createNode('td', tr).addClass('edit-model'),
        div = createNode('div', td, url);
      /* url 可编辑 */
      div.style.outline = 'none';
      div.setAttribute('contentEditable','');
      div.setAttribute('spellcheck', false);
      div.defaultValue = url;
      div.addEventListener('input', throttle(function(){
        var changelistArray = item.changelistArray,
            value = this.innerText,
            defaultValue = this.defaultValue,
            isRepeat = changelistArray.filter(function(v){
              return v[value];
            }).length;

        if(isRepeat){
          showToast(main, '拦截的url不能重复设置');
          this.innerText = defaultValue;
        }else{
          changelistArray.forEach(function(v){
            v[value] = v[defaultValue];
            delete v[defaultValue];
          });
          item.tabId === 'all' && bg.syncStore4Listener(allListeners.all.listeners);
          this.defaultValue = value;
        }
      }, 200));

      listenerLinks.push(url.toLowerCase());
      listenerLinkDOMs.push({parent: tr, child: div, url: url});

      var a = createNode('a', td).addClass('icon-remove icon revert');
      a.addEventListener('click', function(e){
        restoreListener.call(this, item);
        e.stopPropagation();
      });

      var trNext = createNode('tr', table).addClass('header-box').addClass('display-none');
      createNode('td', trNext).addClass('headers').setAttribute('colspan', '4');

      /* add click event for tr */
      listenClick(tr, headerData, function(parent, data){
        var head = {
          request: 'Request Headers',
          response: 'Response Headers'
        };

        /* 创建tr点击后展开的header列表 */
        data.headers.forEach(function(item){
          /* 创建请求和响应头标示 */
          var headerText;
          if(headerText = head[item.type]){
            head[item.type] = false;
            var tHead = createNode('tr', parent).addClass('title'),
              th = createNode('th', tHead, headerText);
            th.setAttribute('colspan', '4');
          }

          /* 生成headers map列表 */
          var currentTR = createNode('tr', parent);
          createNode('div', createNode('td', currentTR), item.key);
          var div = createNode('div', createNode('td', currentTR)).addClass('edit-header'),
            keyValue, type, title;
          if(item.value === true){
            keyValue = '-';
            type = 'D';
            title = '表示' + item.key + '已被删除';
          }else{
            keyValue = item.value;
            type = 'A/M';
            title = '表示' + item.key + '是新增字段或被修改过';
          }
          div = createNode('div', div, keyValue);
          if(type === 'D'){
            div.style.textAlign = 'center';
          }else{
            div.style.outline = 'none';
            div.setAttribute('contentEditable','');
            div.setAttribute('spellcheck', false);
            div.addEventListener('input', throttle(function(){
              item.source[item.key] = this.innerText;
            }, 200));
          }
          var td = createNode('td', currentTR, type).addClass('status' + type === 'D' ? 'delete-status' : 'modify-status');
          td.setAttribute('title', title);

          /* 创建恢复按钮 */
          var a = createNode('a', td).addClass('icon-remove icon revert');
          a.addEventListener('click', function(){
            /* remove current row */
            var headers = data.headers;
            for(var i = headers.length - 1; i >= 0; i--){
              if(headers[i].key === item.key && headers[i].type === item.type){
                headers.splice(i, 1);
                break;
              }
            }
            /* 移除 request/response headers 标题 */
            var prev = currentTR.prev(),
              next = currentTR.next();
            /* 前面节点是header标题, 且后面节点没有或也是header标题 */
            if((!next || next.hasClass('title')) && prev && prev.hasClass('title')){
              parent.removeChild(prev);
            }
            /* 移除当前行 */
            parent.removeChild(currentTR);
            /* 移除拦截规则 或 移除监听器 */
            restoreListener.call(this, data, item.key, item.type);
          });
        });
      });
      addWaveEffect(tr, shadow);
    });
    listenListenerSearch($('listenerSearch').removeClass('display-none'));
  }

  function restoreListener(data, key, type){
    /* allListeners存在意味着不是测试数据 */
    if(allListeners){
      var url = data.url,
        listeners  = allListeners[data.tabId].listeners;

      /* key存在意味着是删除某一个具体的header */
      if(key){
        var webRequestEvent = {
            request: 'onBeforeSendHeaders',
            response: 'onHeadersReceived'
          },
          listenerName = webRequestEvent[type],
          l          = listeners[listenerName],
          changelist = l.changelist,
          map        = changelist[url];

        /* remove header-key in headerMap */
        delete map[key];

        /* remove key in changelist */
        isEmptyObject(map) && emptyChangelist(listeners, listenerName, url);
      }else{
        /* 意味着此时是恢复整个url的所有modiy headers */
        emptyChangelist(listeners, 'onBeforeSendHeaders', url);
        emptyChangelist(listeners, 'onHeadersReceived', url);
      }
      data.tabId === 'all' && bg.syncStore4Listener(listeners);
    }

    if(!key || data.headers.length === 0){
      /* remove parent dom */
      var row = key ? listenerContainer.querySelector('.selected') : this.parentNode.parentNode;
      row.parentNode.removeChild(row.next());
      row.parentNode.removeChild(row);
    }
    showToast(listenerContainer, 'success');
  }

  /* clear changelist */
  function emptyChangelist(listeners, name, url){
    var listener = listeners[name];
    if(listener && listener.changelist && listener.changelist[url]){
      delete listener.changelist[url];

      /* remove changelist & headers listener */
      if(isEmptyObject(listener.changelist)){
        listener.remove();
        delete listeners[name];
      }
    }
  }

  /* 监听输入 */
  function listenChange(type, element, root, btn){
    element.addEventListener('input', throttle(function(){
      var text = this.innerText;
      this.key = this.key || this.getAttribute('data-key');
      this.key = this.key || this.getAttribute('data-key');
      this.url = this.url || document.querySelector('.selected div').innerText;

      addChangeItem(type, this.url, this.key, text);

      /* 改变DOM状态 */
      if(text === this.defaultValue){
        this.removeClass('modified');
        btn.disabled = !root.querySelector('.modified');
      }else{
        this.addClass('modified');
        btn.disabled = false;
      }
    }, 200));
  }

  /* 监听删除 */
  function listenRemove(type, element, key, value, tr, input){
    element.addEventListener('click', function() {
      tr.parentNode.removeChild(tr);
      var url = document.querySelector('.selected div').innerText;
      addChangeItem(type, url, key, value);
      input.disabled = isEmptyObject(changelist);
    });
  }

  /* 当前page搜索 */
  function listenSearch(element) {
    searchFn(element, links, linkDOMs);
  }

  /* all listener 搜索 */
  function listenListenerSearch(element) {
    searchFn(element, listenerLinks, listenerLinkDOMs);
  }

  /* 监听搜索 */
  function searchFn(element, links, linkDOMs){
    element.addEventListener('input', throttle(function(){
      var search = this.value.toLowerCase(),
        s      = search.replace(/([^\w\d_=:])/g,"\\$1"),
        reg    = new RegExp('(' + s + ')', 'gi');

      links.forEach(function(link, i){
        var method = ~link.indexOf(search) ? 'removeClass' : 'addClass',
          o      = linkDOMs[i],
          parent = o.parent;
        parent[method]('display-none');
        /* 高亮匹配到的文本 */
        setTimeout(function(){
          o.child.innerHTML = s ? o.url.replace(reg, '<span>$1</span>') : o.url;
          /* 切换选中项及其headers列表的可见性 */
          if(parent.hasClass('selected')){
            var next = parent.next();
            method === 'addClass' && !next.hasClass('display-none') && (next.addClass('display-none').needShow = true);
            method === 'removeClass' && next.needShow && (next.removeClass('display-none').needShow = false);
          }
        }, 0);
      });
    }, 200));
  }

  /* 增加header修改项 */
  function addChangeItem(type, url, key, value){
    !changelist[type] && (changelist[type] = {});
    var headersMap = changelist[type][url],
      map = {};

    map[key] = value;
    if(headersMap){
      if(value === false){
        delete headersMap[key];
        if(isEmptyObject(headersMap)){
          delete changelist[type][url];
        }
      }else{
        Object.assign(headersMap, map);
      }
    }else{
      changelist[type][url] = map;
    }
  }

  /* 监听preserve log checkbox */
  function listenLog(element){
    element.addEventListener('click', function(){
      this.toggleClass('checked');
      bg && bg.setPreserveLog(tabId, this.hasClass('checked'));
    });
  }

  /* 监听global switch checkbox */
  function listenGlobalSwitch(element){
    element.addEventListener('click', function(){
      this.toggleClass('checked');
    });
  }

  /* 监听清除按钮 */
  function listenClear(element){
    element.addEventListener('click', function(){
      if(messages){
        bg && bg.clearMessages(tabId, true);
        messages = null;
        container.innerHTML = '';
        setTips('消息已清空...', container);
      }
    });
    addWaveEffect(element, shadow);
  }

  /* 设置弹框 */
  function toggleSettingDialog(){
    document.getElementById('settingDialog').toggleClass('display-none');
  }

  /* 设置提示 */
  function setTips(tip, target){
    var div = createNode('div', target, tip);
    addWaveEffect(div, shadow);
    div.className = 'tips';
  }

  /* 设置波浪效果 */
  function addWaveEffect(element, target){
    target = target || element;
    element.addEventListener('mousedown', function(e){
      var event = document.createEvent('MouseEvents');
      /* 该方法已废弃 */
      event.initMouseEvent('mousedown', true, true, window, 0, 0, 0, e.clientX, e.clientY, false, false, false, false, 0, null);
      target.dispatchEvent(event);
      event.initMouseEvent('mouseup', true, true, window, 0, 0, 0, e.clientX, e.clientY, false, false, false, false, 0, null);
      target.dispatchEvent(event);
    });
  }

  /* 显示toast */
  function showToast(parent, text){
    window.clearTimeout(timer);
    var t = document.getElementsByClassName('toast');
    t.length && t[0].parentNode.removeChild(t[0]);
    t = createNode('a', parent, text);
    t.className = 'toast';
    timer = setTimeout(function(){
      t.style.opacity = 0;
      timer = setTimeout(function(){
        t.parentNode.removeChild(t);
      }, 1000);
    }, 1000);
  }

  /* 是否空对象 */
  function isEmptyObject(obj){
    var key;
    for(key in obj){
      if(obj.hasOwnProperty(key)){
        return false;
      }
    }
    return true;
  }

  /* 节流 */
  function throttle(fn, delay){
    var timer = null;
    return function(){
      var _this = this,
        args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function(){
        fn.apply(_this, args); // ES 5.1 generic array-like object as arguments, chrome, firefox realized.
      }, delay);
    };
  }

  function extendHTML(){
    /* 前一个元素 */
    HTMLElement.prototype.prev = function(){
      var prevItem = this.previousSibling;
      while (prevItem && prevItem.nodeType != 1 && prevItem.previousSibling != null) {
        prevItem = prevItem.previousSibling;
      }
      return prevItem;
    };
    /* 后一个元素 */
    HTMLElement.prototype.next = function(){
      var nextItem = this.nextSibling;
      while (nextItem && nextItem.nodeType != 1 && nextItem.nextSibling != null) {
        nextItem = nextItem.nextSibling;
      }
      return nextItem;
    };
    /* 添加class */
    HTMLElement.prototype.addClass = function(className) {
      if (this._type != 'null_obj') {
        if (!new RegExp('(^|\\s+)'+className).test(this.className)) {
          this.className += (this.className ? ' ' : '') + className;
        }
      }
      return this;
    };
    /* 去掉class */
    HTMLElement.prototype.removeClass = function(className) {
      if (this._type != 'null_obj') {
        this.className = this.className.replace(new RegExp('(^|\\s+)'+className), "");
      }
      return this;
    };
    /* 判断有无class */
    HTMLElement.prototype.hasClass = function(className) {
      if (this._type != 'null_obj') {
        var regExp = new RegExp('(?:^|\\s+)' + className + '(?:\\s+|$)');
        return regExp.test(this.className);
      }
    };
    /* 切换class */
    HTMLElement.prototype.toggleClass = function(className) {
      if (this._type != 'null_obj') {
        this.hasClass(className) ? this.removeClass(className) : this.addClass(className);
      }
      return this;
    };

    /* 事件委托 */
    HTMLElement.prototype.on = function(matchStr, event, fn) {
      if (this._type != 'null_obj' && typeof matchStr === 'string' && typeof event === 'string' && typeof fn === 'function') {
        var isClass = matchStr.indexOf('.') === 0;
        isClass && (matchStr = matchStr.substring(1));
        this.addEventListener(event, function(e){
          var item = e.target;
          if(item && (isClass ? item.hasClass(matchStr) : item.nodeName === matchStr.toUpperCase())){
            fn.call(item, e);
          }
        });
      }
      return this;
    };
  }
}