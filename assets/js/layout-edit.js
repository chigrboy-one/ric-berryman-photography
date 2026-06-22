/* layout-edit.js — in-page photo-essay layout editor for field notes.
   Loads ONLY on localhost with ?edit (same gate/Studio root as gallery-edit).
   Lets you, on a [data-layout-page] article:
     • drag image cards to reorder the whole flow
     • click a card to cycle its size: FULL (bleed) → INSET (contained) → HALF (pairs)
     • consecutive HALF cards render side-by-side as a pair
   Save rewrites the page's own HTML between the LAYOUT markers, on your real
   disk via the File System Access API. Paragraph/quote blocks are preserved
   verbatim and stay reorderable. The published page is plain static HTML —
   this editor never ships (localhost only). */
(function () {
  'use strict';
  var isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].indexOf(location.hostname) !== -1;
  // strictly URL-driven: edit mode only while ?edit (or #edit) is in the address.
  // Remove it and you get the normal page — no sticky state to clear.
  var wantsEdit = /[?&]edit\b/.test(location.search) || /\bedit\b/.test(location.hash);
  try { localStorage.removeItem('rbEdit'); } catch (e) {}   // clear any old sticky flag
  var region = document.querySelector('[data-layout-page]');
  if (!isLocal || !wantsEdit || !region) return;

  var FS_OK = 'showDirectoryPicker' in window;
  var PAGE = region.getAttribute('data-layout-page');       // e.g. "george-floyd"
  var FILE = PAGE + '.html';
  var ALT = region.getAttribute('data-layout-alt') || '';

  /* ---------- Studio root handle (shared with gallery-edit) ---------- */
  function idb(cb){var r=indexedDB.open('rb-studio',1);r.onupgradeneeded=function(){r.result.createObjectStore('handles');};r.onsuccess=function(){cb(r.result);};r.onerror=function(){cb(null);};}
  function idbGet(k){return new Promise(function(res){idb(function(db){if(!db)return res(null);var t=db.transaction('handles','readonly').objectStore('handles').get(k);t.onsuccess=function(){res(t.result||null);};t.onerror=function(){res(null);};});});}
  function idbSet(k,v){return new Promise(function(res){idb(function(db){if(!db)return res();var t=db.transaction('handles','readwrite').objectStore('handles').put(v,k);t.onsuccess=function(){res();};t.onerror=function(){res();};});});}
  var rootHandle = null;
  async function ensureRoot(){
    if(rootHandle){ if((await rootHandle.queryPermission({mode:'readwrite'}))==='granted')return rootHandle; if((await rootHandle.requestPermission({mode:'readwrite'}))==='granted')return rootHandle; }
    var saved=await idbGet('root');
    if(saved){ rootHandle=saved; if((await rootHandle.queryPermission({mode:'readwrite'}))==='granted')return rootHandle; if((await rootHandle.requestPermission({mode:'readwrite'}))==='granted')return rootHandle; }
    if(!window.confirm('ONE-TIME SETUP\n\nPick your website PROJECT folder (the one containing "assets" and "data"). Chrome remembers it, so you only do this once.'))throw new Error('Setup cancelled');
    var picked=await window.showDirectoryPicker({id:'rb-root',mode:'readwrite',startIn:'desktop'});
    try{await picked.getDirectoryHandle('assets');}catch(e){throw new Error('That folder has no "assets" inside — pick the project root and try Save again.');}
    rootHandle=picked; await idbSet('root',rootHandle); return rootHandle;
  }

  function setStatus(m,k){var el=document.getElementById('le-status');if(el){el.textContent=m;el.className='le-status'+(k?' le-'+k:'');}}
  var dirty=false; function markDirty(){dirty=true;setStatus('Unsaved changes','warn');}

  /* ---------- parse current article DOM into a flat block list ---------- */
  function parse(){
    var blocks=[];
    [].forEach.call(region.children, function(el){
      if(el.nodeType!==1) return;
      // anything explicitly locked, OR anything we don't recognize, is preserved
      // verbatim (draggable, not resizable) so save() never drops custom markup —
      // e.g. the comet "Anza Borrego" overlay or a hand-tuned diptych width.
      if(el.hasAttribute('data-le-raw')){
        blocks.push({kind:'raw', html: el.outerHTML});
      } else if(el.classList.contains('fn-essay')){
        blocks.push({kind:'text', html: el.outerHTML});
      } else if(el.classList.contains('fn-plate')){
        var im=el.querySelector('img');
        blocks.push({kind:'img', size: el.classList.contains('fn-plate--bleed')?'full':'inset', src: im.getAttribute('src'), alt: im.alt||ALT});
      } else if(el.matches('section.figure')){
        el.querySelectorAll('.figure-frame img, .fn-plate-inner img').forEach(function(im){
          blocks.push({kind:'img', size:'half', src: im.getAttribute('src'), alt: im.alt||ALT});
        });
      } else {
        blocks.push({kind:'raw', html: el.outerHTML});
      }
    });
    return blocks;
  }

  /* ---------- build the editor surface ---------- */
  var SIZES=['full','inset','half'];
  function makeCard(b){
    var card=document.createElement('div');
    card.className='le-card le-'+(b.kind==='text'||b.kind==='raw'?'text':b.size);
    card.setAttribute('draggable','true');
    card.dataset.kind=b.kind;
    if(b.kind==='text'||b.kind==='raw'){ card.__html=b.html; var tp=document.createElement('div'); tp.className='le-textprev'; tp.innerHTML=b.html; card.appendChild(tp); var tag=document.createElement('span'); tag.className='le-tag'; tag.textContent=(b.kind==='raw'?'LOCKED':'TEXT'); card.appendChild(tag); }
    else {
      card.dataset.src=b.src; card.dataset.alt=b.alt||''; card.dataset.size=b.size;
      var img=document.createElement('img'); img.src=b.src; img.setAttribute('draggable','false'); card.appendChild(img);
      var btn=document.createElement('button'); btn.type='button'; btn.className='le-size'; btn.textContent=b.size.toUpperCase();
      btn.addEventListener('click', function(e){ e.stopPropagation();
        var cur=card.dataset.size; var next=SIZES[(SIZES.indexOf(cur)+1)%SIZES.length];
        card.dataset.size=next; card.className='le-card le-'+next; btn.textContent=next.toUpperCase(); markDirty();
      });
      card.appendChild(btn);
    }
    // remove button — photos drop instantly; text/locked blocks confirm first
    var del=document.createElement('button'); del.type='button'; del.className='le-del'; del.title='Remove'; del.textContent='×';
    del.addEventListener('click', function(e){ e.stopPropagation();
      if(b.kind==='img' || window.confirm('Remove this '+(b.kind==='raw'?'locked block':'text block')+'?\n\n(Reload before saving to undo.)')){
        card.remove(); markDirty();
      }
    });
    card.appendChild(del);
    card.addEventListener('dragstart', function(e){ card.classList.add('le-dragging'); if(e.dataTransfer){e.dataTransfer.effectAllowed='move'; try{e.dataTransfer.setData('text/plain','card');}catch(_){}} });
    card.addEventListener('dragend', function(){ card.classList.remove('le-dragging'); markDirty(); });
    return card;
  }

  var surface=document.createElement('div'); surface.className='le-surface';
  function afterElement(x,y){
    var els=[].slice.call(surface.querySelectorAll('.le-card:not(.le-dragging)'));
    var closest={d:Infinity,el:null};
    els.forEach(function(el){var r=el.getBoundingClientRect();var d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));if(d<closest.d)closest={d:d,el:el};});
    return closest.el;
  }
  surface.addEventListener('dragover', function(e){
    e.preventDefault();
    var drag=surface.querySelector('.le-dragging'); if(!drag)return;
    var ref=afterElement(e.clientX,e.clientY);
    if(ref&&ref!==drag){var r=ref.getBoundingClientRect();var before=e.clientY<r.top+r.height/2||(Math.abs(e.clientY-(r.top+r.height/2))<r.height/2&&e.clientX<r.left+r.width/2);surface.insertBefore(drag, before?ref:ref.nextSibling);}
  });

  function build(){
    var blocks=parse();
    region.innerHTML='';
    blocks.forEach(function(b){ surface.appendChild(makeCard(b)); });
    region.appendChild(surface);
  }

  /* ---------- serialize editor surface back to article HTML ---------- */
  function imgFig(cls,src,alt){return '    <figure class="fn-plate '+cls+'"><div class="fn-plate-inner" data-reveal><img src="'+src+'" alt="'+(alt||'')+'" loading="lazy"></div></figure>';}
  function diptych(a,b){
    return '    <section class="figure">\n      <div class="diptych-inner">\n'+
      '        <div class="figure-frame" data-reveal><img src="'+a.src+'" alt="'+(a.alt||'')+'" loading="lazy"></div>\n'+
      '        <div class="figure-frame" data-reveal><img src="'+b.src+'" alt="'+(b.alt||'')+'" loading="lazy"></div>\n'+
      '      </div>\n    </section>';
  }
  function serialize(){
    var cards=[].slice.call(surface.querySelectorAll('.le-card'));
    var out=[]; var i=0;
    while(i<cards.length){
      var c=cards[i];
      if(c.dataset.kind==='text'||c.dataset.kind==='raw'){ out.push('    '+c.__html); i++; }
      else if(c.dataset.size==='full'){ out.push(imgFig('fn-plate--bleed',c.dataset.src,c.dataset.alt)); i++; }
      else if(c.dataset.size==='inset'){ out.push(imgFig('fn-plate--inset',c.dataset.src,c.dataset.alt)); i++; }
      else { // half run
        var run=[]; while(i<cards.length && cards[i].dataset.kind==='img' && cards[i].dataset.size==='half'){ run.push({src:cards[i].dataset.src,alt:cards[i].dataset.alt}); i++; }
        for(var j=0;j<run.length;j+=2){ if(j+1<run.length) out.push(diptych(run[j],run[j+1])); else out.push(imgFig('fn-plate--inset',run[j].src,run[j].alt)); }
      }
    }
    return out.join('\n\n');
  }

  async function save(){
    if(!FS_OK){setStatus('Saving needs Chrome or Edge.','err');return;}
    try{
      setStatus('Saving…');
      var root=await ensureRoot();
      var fh=await root.getFileHandle(FILE);
      var text=await (await fh.getFile()).text();
      var START='<!-- LAYOUT:START -->', END='<!-- LAYOUT:END -->';
      var a=text.indexOf(START), b=text.indexOf(END);
      if(a<0||b<0){setStatus('Layout markers not found in '+FILE,'err');return;}
      var body=serialize();
      var newText=text.slice(0,a+START.length)+'\n'+body+'\n  '+text.slice(b);
      var w=await fh.createWritable(); await w.write(newText); await w.close();
      dirty=false; setStatus('Saved ✓ — reload to preview, then commit & push','ok');
    }catch(err){ setStatus('Save failed: '+(err&&err.message||err),'err'); }
  }

  function toolbar(){
    var bar=document.createElement('div'); bar.className='le-bar';
    bar.innerHTML='<span class="le-badge">LAYOUT</span>'+
      '<span class="le-hint">drag to reorder · click a photo to cycle FULL / INSET / HALF · two HALFs pair up · hover &amp; × to remove</span>'+
      '<span id="le-status" class="le-status">Ready</span>'+
      '<button id="le-save" type="button">Save</button>';
    document.body.appendChild(bar);
    document.getElementById('le-save').addEventListener('click', save);
    addEventListener('beforeunload', function(e){ if(dirty){e.preventDefault();e.returnValue='';} });
  }

  function boot(){
    var css=document.createElement('link'); css.rel='stylesheet'; css.href='/assets/css/layout-edit.css'; document.head.appendChild(css);
    document.body.classList.add('le-editing');
    build(); toolbar();
    if(!FS_OK) setStatus('Saving needs Chrome or Edge.','warn');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
