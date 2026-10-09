/* QR Code (nível de correção M, modo bytes, versões 1–10). Usado por index.html e gerador.html */
(function(){
  window.QR = (function () {
    var ECC_PER_BLOCK = [0,10,16,26,18,24,16,18,22,22,26];
    var NUM_BLOCKS    = [0, 1, 1, 2, 2, 2, 4, 4, 4, 5, 5];

    function rawModules(v){
      var r=(16*v+128)*v+64;
      if(v>=2){ var n=Math.floor(v/7)+2; r-=(25*n-10)*n-55; if(v>=7) r-=36; }
      return r;
    }
    function dataCodewords(v){ return Math.floor(rawModules(v)/8) - ECC_PER_BLOCK[v]*NUM_BLOCKS[v]; }
    function alignPos(v){
      if(v===1) return [];
      var n=Math.floor(v/7)+2, size=v*4+17;
      var step=Math.ceil((v*4+4)/(n*2-2))*2, res=[6];
      for(var p=size-7; res.length<n; p-=step) res.splice(1,0,p);
      return res;
    }
    function gfMul(x,y){ var z=0; for(var i=7;i>=0;i--){ z=(z<<1)^((z>>>7)*0x11D); z^=((y>>>i)&1)*x; } return z&0xFF; }
    function rsDivisor(d){
      var r=[]; for(var i=0;i<d-1;i++) r.push(0); r.push(1);
      var root=1;
      for(var i=0;i<d;i++){
        for(var j=0;j<r.length;j++){ r[j]=gfMul(r[j],root); if(j+1<r.length) r[j]^=r[j+1]; }
        root=gfMul(root,2);
      }
      return r;
    }
    function rsRemainder(data,div){
      var r=div.map(function(){return 0;});
      data.forEach(function(b){
        var f=b^r.shift(); r.push(0);
        div.forEach(function(c,i){ r[i]^=gfMul(c,f); });
      });
      return r;
    }
    function utf8(str){ return Array.prototype.slice.call(unescape(encodeURIComponent(str))).map(function(c){return c.charCodeAt(0);}); }

    function encode(text){
      var bytes=utf8(text), ver;
      for(ver=1; ver<=10; ver++){
        var cc = ver<10 ? 8 : 16;
        if(4+cc+bytes.length*8 <= dataCodewords(ver)*8) break;
      }
      if(ver>10) throw new Error("Texto muito longo para o QR Code");
      var bits=[];
      function put(val,len){ for(var i=len-1;i>=0;i--) bits.push((val>>>i)&1); }
      put(4,4); put(bytes.length, ver<10?8:16); bytes.forEach(function(b){ put(b,8); });
      var cap=dataCodewords(ver)*8;
      put(0, Math.min(4, cap-bits.length));
      while(bits.length%8) bits.push(0);
      for(var pad=0xEC; bits.length<cap; pad^=0xEC^0x11) put(pad,8);
      var data=[]; for(var i=0;i<bits.length;i+=8){ var b=0; for(var k=0;k<8;k++) b=(b<<1)|bits[i+k]; data.push(b); }

      // blocos + Reed-Solomon
      var nb=NUM_BLOCKS[ver], eb=ECC_PER_BLOCK[ver], raw=Math.floor(rawModules(ver)/8);
      var nShort=nb-raw%nb, shortLen=Math.floor(raw/nb), div=rsDivisor(eb), blocks=[], k2=0;
      for(var i=0;i<nb;i++){
        var len=shortLen-eb+(i<nShort?0:1);
        var dat=data.slice(k2,k2+len); k2+=len;
        var ecc=rsRemainder(dat,div);
        if(i<nShort) dat.push(0);
        blocks.push(dat.concat(ecc));
      }
      var all=[];
      for(var i=0;i<blocks[0].length;i++)
        for(var j=0;j<blocks.length;j++)
          if(i!==shortLen-eb || j>=nShort) all.push(blocks[j][i]);

      // matriz
      var size=ver*4+17, m=[], fn=[];
      for(var y=0;y<size;y++){ m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
      function set(x,y,d){ m[y][x]=!!d; fn[y][x]=true; }
      for(var i=0;i<size;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
      function finder(cx,cy){
        for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){
          var xx=cx+dx, yy=cy+dy;
          if(xx>=0&&xx<size&&yy>=0&&yy<size){ var d=Math.max(Math.abs(dx),Math.abs(dy)); set(xx,yy,d!==2&&d!==4); }
        }
      }
      finder(3,3); finder(size-4,3); finder(3,size-4);
      var ap=alignPos(ver), n=ap.length;
      for(var i=0;i<n;i++) for(var j=0;j<n;j++){
        if((i===0&&j===0)||(i===0&&j===n-1)||(i===n-1&&j===0)) continue;
        for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++) set(ap[i]+dx,ap[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
      }
      function fmt(mask){
        var d=(0<<3)|mask, rem=d;                       // nível M = 0
        for(var i=0;i<10;i++) rem=(rem<<1)^((rem>>>9)*0x537);
        var bits=((d<<10)|rem)^0x5412;
        function bt(i){ return ((bits>>>i)&1)!==0; }
        for(var i=0;i<=5;i++) set(8,i,bt(i));
        set(8,7,bt(6)); set(8,8,bt(7)); set(7,8,bt(8));
        for(var i=9;i<15;i++) set(14-i,8,bt(i));
        for(var i=0;i<8;i++) set(size-1-i,8,bt(i));
        for(var i=8;i<15;i++) set(8,size-15+i,bt(i));
        set(8,size-8,true);
      }
      fmt(0);
      if(ver>=7){
        var rem=ver; for(var i=0;i<12;i++) rem=(rem<<1)^((rem>>>11)*0x1F25);
        var vb=(ver<<12)|rem;
        for(var i=0;i<18;i++){ var bit=((vb>>>i)&1)!==0, a=size-11+i%3, b2=Math.floor(i/3); set(a,b2,bit); set(b2,a,bit); }
      }
      // dados em zigue-zague
      var idx=0;
      for(var right=size-1; right>=1; right-=2){
        if(right===6) right=5;
        for(var vert=0; vert<size; vert++) for(var j=0;j<2;j++){
          var x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert;
          if(!fn[y][x] && idx<all.length*8){ m[y][x]=((all[idx>>>3]>>>(7-(idx&7)))&1)!==0; idx++; }
        }
      }
      // máscara com menor penalidade
      function applyMask(mask){
        for(var y=0;y<size;y++) for(var x=0;x<size;x++){
          if(fn[y][x]) continue;
          var inv;
          switch(mask){
            case 0: inv=(x+y)%2===0; break; case 1: inv=y%2===0; break; case 2: inv=x%3===0; break;
            case 3: inv=(x+y)%3===0; break; case 4: inv=(Math.floor(x/3)+Math.floor(y/2))%2===0; break;
            case 5: inv=x*y%2+x*y%3===0; break; case 6: inv=(x*y%2+x*y%3)%2===0; break;
            default: inv=((x+y)%2+x*y%3)%2===0;
          }
          if(inv) m[y][x]=!m[y][x];
        }
      }
      function penalty(){
        var p=0, dark=0, y, x, i;
        function runs(get){
          var s=0;
          for(var a=0;a<size;a++){
            var run=1;
            for(var b=1;b<size;b++){
              if(get(a,b)===get(a,b-1)) run++; else { if(run>=5) s+=run-2; run=1; }
            }
            if(run>=5) s+=run-2;
          }
          return s;
        }
        p+=runs(function(a,b){return m[a][b];});
        p+=runs(function(a,b){return m[b][a];});
        for(y=0;y<size-1;y++) for(x=0;x<size-1;x++){ var c=m[y][x]; if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1]) p+=3; }
        var pat=[true,false,true,true,true,false,true];
        function fp(get){
          var s=0;
          for(var a=0;a<size;a++) for(var b=0;b<=size-7;b++){
            var ok=true; for(var k=0;k<7;k++) if(get(a,b+k)!==pat[k]){ ok=false; break; }
            if(!ok) continue;
            var l=true, r=true;
            for(var k=1;k<=4;k++){ if(b-k>=0&&get(a,b-k)) l=false; if(b+6+k<size&&get(a,b+6+k)) r=false; }
            if(l||r) s+=40;
          }
          return s;
        }
        p+=fp(function(a,b){return m[a][b];});
        p+=fp(function(a,b){return m[b][a];});
        for(y=0;y<size;y++) for(x=0;x<size;x++) if(m[y][x]) dark++;
        var total=size*size, k3=Math.ceil(Math.abs(dark*20-total*10)/total)-1;
        return p+Math.max(0,k3)*10;
      }
      var best=0, bestP=Infinity;
      for(var mk=0;mk<8;mk++){
        applyMask(mk); fmt(mk);
        var pn=penalty(); if(pn<bestP){ bestP=pn; best=mk; }
        applyMask(mk);                       // desfaz
      }
      applyMask(best); fmt(best);
      return m;
    }

    function draw(canvas,text,scale){
      var m=encode(text), n=m.length, q=4, px=scale||8;
      canvas.width=canvas.height=(n+q*2)*px;
      var c=canvas.getContext("2d");
      c.fillStyle="#fff"; c.fillRect(0,0,canvas.width,canvas.height);
      c.fillStyle="#0b3d3b";
      for(var y=0;y<n;y++) for(var x=0;x<n;x++) if(m[y][x]) c.fillRect((x+q)*px,(y+q)*px,px,px);
    }
    return { draw:draw, encode:encode };
  })();
})();
