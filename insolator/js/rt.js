/******************************
 * Simple Javascript Raytracer example,
 * 2008/10/20 - mark.webster@gmail.com
 * Feel free to do whatever you want with this source.
 * Adapted for insolator Adam Wight 2011
 */

/************
 * Vars
 */
	function getl(id) { return document.getElementById(id); }
	function checked(id) { return getl(id).checked; }
	
	var fov = 70;						// field of view
	var fovy;
	var eyez = -20;						// eye position in relation to viewplane
	var vw,vh;							// viewplane width/height (viewplane is z=0)
	var amb  = 0.15;					// ambient lighting
	var maxlevel = 20;					// maximum number of reflection recursions
	var eyez2=eyez*eyez;
	var rdn = 3.1415926535897932384626433832/180;

	var antialias = false;				// true = SLOOOOOOOOOOOOOOOOOOOOW!
	var bilinear = true;
	var cam	= {x:-85, y:90, z:-260};	// camera position
//	var cam = {x:120.24, y:151.63, z:218.39};
	var look={x:-11, y:0, z:-50};		// look at point
	var up	={x:0, y:1, z:0	};			// up vector
	var viewmat = [ {x:1,y:0,z:0},		// the above 3 vectors will be normalised
					{x:0,y:1,z:0},		// and cross-produced into this matrix
					{x:0,y:0,z:1},
					{x:0,y:0,z:0}];
	
	var wid, hei;						// canvas width/height
	var wh, hh, ivw, ivh;
	
	var canv, ctx=false, imgdata=false, pix;
	var toggle=0;
	var show = false;
	
	var sp = new Array();
	var numsp = 0;
	var cy = new Array();
	var numcy = 0;
	var pl = new Array();
	var numpl = 0;
	var li = new Array();
	var numli = 0;
	
	var ob = new Array();
	var numob = 0;

	var framenum = 0;
	
	var textures = new Object();
	var texturewaiting = 0;


	/****************************************************
	 * Raytracing / intersection vars because passing args is slow
	 */
	var ix,iy,iz,	// incident (intersection) vector position
		idoti,		// incident dot incident
		iobj,		// last ray intersected object
		icyl,ndir,	// length along cylinder axis, and incident normal direction
		nx,ny,nz,	// normal at incident
		ez,			// vector to eye at incident (0-ix, 0-iy, eyez-iz)
		lx,ly,lz,	// vector from incident to current light
		ldotl,idotl,// light-dot-light, incident-dot-light
		cl;		// ray's accumulated colour (will be pixel), in Gray64

	var xy;			// pointer to current pixel in buffer
	// Current ray
	var r = {ox:0, oy:0, oz:0, dx:0, dy:0, dz:0, odotd:0, odoto:0, ddotd:0};
	// Current closest intersect vars
	var mt,mo,mndir	// closest dist, object, and normal direction;

	
/***********************************
 * Scene primitives
 *
 * All primitives have common material properties:
 *	(cr,cg,cb) = colour
 *	d = diffuse weight (0..1)
 *	p = phong weight (0..1)
 *	pp = phong power coefficient (higher = more acute specular)
 *	rf = reflectivity (0..1)
 */

	/*************************************
	 * Infinite plane definition
	 */
	// (x0,y0,z0)-(x1,y1,z1)-(x2,y2,z2) = co-planar point (counter-clockwise)
	function plane(x0,y0,z0, x1,y1,z1, x2,y2,z2, cl, d,ph,pp,rf) {
		pl[numpl] = new Object();
		var p = pl[numpl];
		var nx,ny,nz,l;
		
		p.x=x0;		p.y=y0;		p.z=z0;
		p.ux=x1-x0;	p.uy=y1-y0;	p.uz=z1-z0;
		p.vx=x2-x0;	p.vy=y2-y0;	p.vz=z2-z0;
		p.cl=cl;	p.d=d;
		p.p=ph;		p.pp=pp;	p.rf=rf;
		// cross product to find normal
		p.nx=p.uy*p.vz - p.uz*p.vy;
		p.ny=p.uz*p.vx - p.ux*p.vz;
		p.nz=p.ux*p.vy - p.uy*p.vx;
		// normalise normal
		l = Math.sqrt(p.nx*p.nx + p.ny*p.ny + p.nz*p.nz);
		p.nx/=l;	p.ny/=l;	p.nz/=l;
		
		p.precalc = function() {
			// find D
			this.D = this.nx*this.x + this.ny*this.y + this.nz*this.z;
			this.ul2 = this.ux*this.ux + this.uy*this.uy + this.uz*this.uz;
			this.vl2 = this.vx*this.vx + this.vy*this.vy + this.vz*this.vz;
		};
		p.setuv = function(ux,uy,uz, vx,vy,vz, uo,vo, texturefunc) {
			this.ocl=this.cl;
			this.ux=ux;	this.uy=uy;	this.uz=uz;	this.vx=vx;	this.vy=vy;	this.vz=vz;
			this.uo=uo;	this.vo=vo;	this.texture = texturefunc;
			return this;
		}
		p.setbitmap = function(imgurl) { setbitmap(this, imgurl); return this; }
		p.texture = function(){};

		p.hit = pl_hit;
		p.intersect = pl_intersect;
		p.li_intersect = pl_li_intersect;
		p.getuv = function() {
			var dx,dy,dz;
			dx= ix-this.x;	dy= iy-this.y;	dz= iz-this.z;
			this.u = this.uo + (dx*this.ux + dy*this.uy + dz*this.uz)/this.ul2;
			this.v = 1 - this.vo - (dx*this.vx + dy*this.vy + dz*this.vz)/this.vl2;
		}

		p.precalc();
		p.obj = numob;
		ob[numob++] = pl[numpl];
		numpl++;
		return p;
	}
	
		function pl_intersect() {
			var t,dx,dy,dz,u,v,ix,iy,iz;
			if (this.obj==iobj) return;
			t = (this.D - this.nx*r.ox - this.ny*r.oy - this.nz*r.oz) /
				(this.nx*r.dx + this.ny*r.dy + this.nz*r.dz);
			if (t<=0 || t>=mt) return;
/*
			// incident point
			ix = r.ox + r.dx*t;
			iy = r.oy + r.dy*t;
			iz = r.oz + r.dz*t;
			dx= ix-this.x;	dy= iy-this.y;	dz= iz-this.z;
			u = dx*this.ux + dy*this.uy + dz*this.uz;
			if (u<0 || u>this.ul2) return;
			v = dx*this.vx + dy*this.vy + dz*this.vz;
			if (v<0 || v>this.vl2 || (u/this.ul2+v/this.vl2)>1) return;
	*/		
			mt=t; mo=this.obj;	mndir=1;
		}
		
		function pl_hit() {
			// incident point
			ix = r.ox + r.dx*mt;
			iy = r.oy + r.dy*mt;
			iz = r.oz + r.dz*mt;
			// normal
			nx = this.nx;
			ny = this.ny;
			nz = this.nz;
		}
		
		function pl_li_intersect() {
			if (this.obj==iobj) return false;
			var t;
			t = (this.D - this.nx*ix - this.ny*iy - this.nz*iz) / (this.nx*lx + this.ny*ly + this.nz*lz);
			return (t>0 && t<1);
		}

	/*************************************
	 * Disc defintion
	 */
	// (x,y,z)=centre, (nx,ny,nz)=normal
	function disc(x,y,z, nx,ny,nz, r, cl, d,ph,pp,rf) {
		pl[numpl] = new Object();
		var p = pl[numpl];
		
		p.x =x;		p.y =y;		p.z =z;
		p.cl=cl;	p.d=d;
		p.p=ph;		p.pp=pp;	p.rf=rf;
		l = Math.sqrt(nx*nx + ny*ny + nz*nz);
		p.nx=nx/l;	p.ny=ny/l;	p.nz=nz/l;

		p.precalc = function() {
			this.r2=r*r;
			this.D = this.nx*this.x + this.ny*this.y + this.nz*this.z;
			this.ul2 = this.ux*this.ux + this.uy*this.uy + this.uz*this.uz;
			this.vl2 = this.vx*this.vx + this.vy*this.vy + this.vz*this.vz;
		};
		p.setuv = function(ux,uy,uz, vx,vy,vz, uo,vo, texturefunc) {
			this.ocl=this.cl;
			this.ux=ux;	this.uy=uy;	this.uz=uz;	this.vx=vx;	this.vy=vy;	this.vz=vz;
			this.uo=uo;	this.vo=vo;	this.texture = texturefunc;
			return this;
		}
		p.setbitmap = function(imgurl) { setbitmap(this, imgurl); return this; }
		p.texture = function(){};

		p.hit = di_hit;
		p.intersect = di_intersect;
		p.li_intersect = di_li_intersect;
		p.getuv = function() {
			var dx,dy,dz;
			dx= ix-this.x;	dy= iy-this.y;	dz= iz-this.z;
			this.u = this.uo + (dx*this.ux + dy*this.uy + dz*this.uz)/this.ul2;
			this.u = this.uo + (dx*this.ux + dy*this.uy + dz*this.uz)/this.ul2;
			this.v = 1 - this.vo - (dx*this.vx + dy*this.vy + dz*this.vz)/this.vl2;
		}
		
		p.precalc();
		p.obj = numob;
		ob[numob++] = p;
		numpl++;
		return p;
	}
	
		function di_intersect() {
			var t,cix,ciy,ciz;
			if (this.obj==iobj) return;
			t = (this.D - this.nx*r.ox - this.ny*r.oy - this.nz*r.oz) /
				(this.nx*r.dx + this.ny*r.dy + this.nz*r.dz);
			if (t<=0 || t>=mt) return;
			cix = r.ox + t*r.dx - this.x;
			ciy = r.oy + t*r.dy - this.y;
			ciz = r.oz + t*r.dz - this.z;
			if ((cix*cix+ciy*ciy+ciz*ciz) > this.r2) return;
			mt=t; mo=this.obj;	mndir=1;
		}
		
		function di_hit() {
			// incident point
			ix = r.ox + r.dx*mt;
			iy = r.oy + r.dy*mt;
			iz = r.oz + r.dz*mt;
			// normal
			nx = this.nx;
			ny = this.ny;
			nz = this.nz;
		}
		
		function di_li_intersect() {
			if (this.obj==iobj) return false;
			var t,x,y,z;
			t = (this.D - this.nx*ix - this.ny*iy - this.nz*iz) / (this.nx*lx + this.ny*ly + this.nz*lz);
			if (t<=0 || t>=1) return false;

			x = ix + t*lx - this.x;
			y = iy + t*ly - this.y;
			z = iz + t*lz - this.z;
			return ((x*x+y*y+z*z)<=this.r2);
		}
	
	/*******************************
	 * Point light definition
	 */
	// Point light
	function light(x,y,z, i) {
		li[numli] = new Object();
		var l = li[numli];
		l.x=x;	l.y=y;	l.z=z;
		l.i=i;
		l.rad=5;

		l.precalc = function() {
			this.ir = 1/this.rad;
			this.c = this.x*this.x + this.y*this.y + this.z*this.z - this.rad*this.rad;
		};
		l.intersect = light_intersect;
		
		numli++;
		return l;
	}
	
		function light_intersect() {
			var b,b2,c,d, t;
			b = this.x*r.dx + this.y*r.dy + this.z*r.dz - r.odotd;
			if (b<0) return false;
			b2= b*b;
			c = r.odoto - 2*(this.x*r.ox + this.y*r.oy + this.z*r.oz) + this.c;
			d = b2 - r.ddotd*c;
			if (d<0) return false;
			if (b2>d) t=(b-Math.sqrt(d))/r.ddotd; else t=(b+Math.sqrt(d))/r.ddotd;
			if (t<=0 || t>=mt) return false;
			iz = r.oz + t*r.dz;
			nz = (iz - this.z)*this.ir;
			return true;
		}

        function open_floor(etage, cl, d,ph,pp,rf)
        {
            y = etage * 20;
            p = plane(0,y,0, 0,y,-100, -200,y,0, cl, d,ph,pp,rf);
            p.intersect = function()
            {
                var t,dx,dy,dz,u,v,ix,iy,iz;
                if (this.obj==iobj) return;
                t = (this.D - this.nx*r.ox - this.ny*r.oy - this.nz*r.oz) /
                        (this.nx*r.dx + this.ny*r.dy + this.nz*r.dz);
                if (t<=0 || t>=mt)
                {
                    this.hit();
                    //XXX check for hole
                    dx= ix-this.x;	dy= iy-this.y;	dz= iz-this.z;
                    u = dx*this.ux + dy*this.uy + dz*this.uz;
                    if (u<0 || u>this.ul2) return;
                    v = dx*this.vx + dy*this.vy + dz*this.vz;
                    if (v<0 || v>this.vl2 || (u/this.ul2+v/this.vl2)>1) return;
                }
                mt=t; mo=this.obj;	mndir=1;
            }
        }
                    

/********************
 * Texture functions
 */
	function tilebitmap() {
		var i;
		this.getuv();
		this.u = (this.u*this.bmpw % this.bmpw)|0;
		this.v = (this.v*this.bmph % this.bmph)|0;
		if (this.u<0) this.u+=this.bmpw;
		if (this.v<0) this.v+=this.bmph;
		i = this.v*this.bmpw + this.u;
		this.cl = this.bmp[i]*this.ocl;
	}
	
	function tilebitmap_bi() {
		var i,u,v,fu,fv,f,l,p;
		this.getuv();
		fu = (this.u*this.bmpw)%this.bmpw;	if (fu<0) fu+=this.bmpw;
		fv = (this.v*this.bmph)%this.bmph;	if (fv<0) fv+=this.bmph;
		u = fu|0;	fu-=u;	v = fv|0;	fv-=v;
		
		p = this.bmp;		i=v*this.bmpw+u;	f=(1-fu)*(1-fv);
		l=p[i]*f;
		
		u=(u+1)%this.bmpw;	i=v*this.bmpw+u;	f=fu*(1-fv);
		l=p[i]*f;
		
		v=(v+1)%this.bmph;	i=v*this.bmpw+u;	f=fu*fv;
		l=p[i]*f;
		
		u=(u-1)%this.bmpw;	i=v*this.bmpw+u;	f=(1-fu)*fv;
		l=p[i]*f;
		
		this.cl = l*this.ocl;
	}
	
	function bitmap() {
		var i;
		this.getuv();
		this.u = (this.u*this.bmpw)|0;
		this.v = (this.v*this.bmph)|0;
		if (this.u<0 || this.v<0 || this.u>=this.bmpw || this.v>=this.bmph) {
			this.cl=this.ocl;
		} else {
			i = this.v*this.bmpw + this.u;
			this.cl = this.bmp[i]*this.ocl;
		}
	}
	
	function bitmap_bi() {
		var i,u,v,fu,fv,f,l,p;
		this.getuv();
		p = this.bmp;
		fu = this.u*this.bmpw;	u = fu|0;	fu-=u;
		fv = this.v*this.bmph;	v = fv|0;	fv-=v;
		i = v*this.bmpw+u;	f = (1-fu)*(1-fv);
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { l=f; }
		else { l+=p[i]*f; }
		u++; i++; f = fu*(1-fv);
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { l=f; }
		else { l+=p[i]*f; }
		v++; i+=this.bmpw; f = fu*fv;
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { l=f; }
		else { l+=p[i]*f; }
		u--; i--; f = (1-fu)*fv;
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { l=f; }
		else { l+=p[i]*f; }
		
		this.cl = l*this.ocl;
	}
	
	function envmap() {
		var i,u,v;
		u = (this.bmpwh + nx*this.bmpwh)|0;
		v = (this.bmphh - ny*this.bmphh)|0;
		i = v*this.bmpw + u;
		this.cl = this.bmp[i]*this.ocl;
	}
	
/*******************************************
 * Texture (image) load functions
 * NB: Due to browser security limitations, you can
 * only request images from the originating server
 */
	function setbitmap(o, imgurl) {
		if (textures[o.obj]==undefined) {
			texturewaiting++;
				
			var t = new Object();
			o.tex = t;
			t.i = new Image();
			t.i.ownerobj = o;
			t.i.onload = gotbitmap;
			t.i.src = imgurl;
			
			textures[o.obj] = t;
		} else {
			var t = textures[o.obj];
			o.tex  = t;
			o.bmp  = t.bmp;
			o.bmpw = t.i.width;
			o.bmph = t.i.height;
			o.bmpwh= t.i.width/2|0;
			o.bmphh= t.i.height/2|0;
		}
	}

	function gotbitmap() {	// this==Image()
		var o=this.ownerobj;
		if (o.tex) {
			var t=o.tex, w=this.width, h=this.height;
			if (show) {
				t.canv = document.createElement('CANVAS');
				t.canv.setAttribute('width', w);
				t.canv.setAttribute('height', h);
				t.ctx = t.canv.getContext("2d");
				t.ctx.drawImage(this, 0,0);
				o.bmp = new Array();
			}
			if (t.ctx && t.ctx.getImageData) {
				var pix = t.pix = t.ctx.getImageData(0,0,w,h).data;
				for (var i=0,j=0,b=o.bmp; i<w*h*4; i++) {
					mono = pix[i++] + pix[i++] + pix[i++];
					b[j++]=mono/(255*3);
				}
			} else {
				o.bmp = new Array();
				for (var i=0; i<w*h; i++) o.bmp[i]=0.5;
			}
			o.bmpw=w;		o.bmph=h;
			o.bmpwh=w/2|0;	o.bmphh=h/2|0;
			o.tex.bmp = o.bmp;
		} else {
			alert("Error loading "+this.src+" - expect script errors");
		}

		if (--texturewaiting<=0) setTimeout("startframe();", 100);
	}

	
/************************
 * Scenegraph
 */
	function scene() {
		texturewaiting = 0;
		var s,p,d;
		
		//bilinear = getl("bicheck").checked;
		var bitfunc = bilinear ? bitmap_bi : bitmap;
		var tilefunc = bilinear ? tilebitmap_bi : tilebitmap;
		
		ob = new Array();
		sp = new Array();
		pl = new Array();
		li = new Array();
		cy = new Array();
		numob = numsp = numpl = numli = numcy = 0;


		plane(0,-70,0, 0,-70,-100, -200,-70,0, 1, 0.6,1.0,32, 0.4).
			setuv(300,0,0, 0,0,300, 0,0, tilefunc).setbitmap("textures/onix-pina.jpg");
		
		disc(0,60,140,	0,0,-1,		150, 1, 0.5,1.0,64, 0.6).		// far
			setuv(300,0,0, 0,300,0, 0.5,0.5, bitfunc).setbitmap("textures/onix-pina.jpg");


		var ang = (framenum*15)*3.141592654/180;
		ang = Math.sin(ang*3.141592654/2);
		var sin = Math.sin(ang);
		var cos = Math.cos(ang);
		light( sin * 300, 80, cos * 300, 1.0);

		createviewmatrix();
		
		// apply transform
		var i,j,k;
		for (i=0; i<numli; i++) {
			transform_obj(li[i]);
			li[i].precalc();
		}
		for (i=0; i<numob; i++) {
			transform_obj(ob[i]);
			if (ob[i].precalc) ob[i].precalc();
			if (ob[i].inside) {
				transform_obj(ob[i].inside);
				ob[i].inside.precalc();
			}
		}
		
		for (j=0; j<maxlevel; j++) {
			last_li[j] = new Array();
			for (k=0; k<numli; k++) last_li[j][k]=-1;
		}
		
		return !texturewaiting;
	}
	

	function transform(x,y,z, tl) {
		var t = new Object();
		t.x = x*viewmat[0].x	+ y*viewmat[1].x	+ z*viewmat[2].x + viewmat[3].x*tl;
		t.y = x*viewmat[0].y	+ y*viewmat[1].y	+ z*viewmat[2].y + viewmat[3].y*tl;
		t.z = x*viewmat[0].z	+ y*viewmat[1].z	+ z*viewmat[2].z + viewmat[3].z*tl;
		return t;
	}
	
	function transform_obj(o) {
		var t;
		t = transform(o.x-look.x, o.y-look.y, o.z-look.z, 1);
		o.x=t.x;	o.y=t.y;	o.z=t.z;
		if (o.x1!=undefined) {
			t = transform(o.x1-look.x, o.y1-look.y, o.z1-look.z, 1);
			o.x1=t.x;	o.y1=t.y;	o.z1=t.z;
		}
		if (o.nx!=undefined) {
			t = transform(o.nx, o.ny, o.nz, 0);	o.nx=t.x;	o.ny=t.y;	o.nz=t.z;
		}
		if (o.ux!=undefined) {
			t = transform(o.ux, o.uy, o.uz, 0);	o.ux=t.x;	o.uy=t.y;	o.uz=t.z;
		}
		if (o.vx!=undefined) {
			t = transform(o.vx, o.vy, o.vz, 0);	o.vx=t.x;	o.vy=t.y;	o.vz=t.z;
		}
		if (o.wx!=undefined) {
			t = transform(o.wx, o.wy, o.wz, 0);	o.wx=t.x;	o.wy=t.y;	o.wz=t.z;
		}
	}
	
	
	function createviewmatrix() {
		var xx,xy,xz, yx,yy,yz, zx,zy,zz, tx,ty,tz, l;

		// Normalise up (y) vector
		l=Math.sqrt(up.x*up.x + up.y*up.y + up.z*up.z);
		yx=up.x/l;	yy=up.y/l;	yz=up.z/l;
		
		// Normalise lookat (z) vector
		zx=look.x-cam.x;	zy=look.y-cam.y;	zz=look.z-cam.z;
		l=Math.sqrt(zx*zx+zy*zy+zz*zz);
		zx=zx/l;	zy=zy/l;	zz=zz/l;
		
		// Cross-product (up x lookat) to get right vector
		xx = up.y*zz - up.z*zy;
		xy = up.z*zx - up.x*zz;
		xz = up.x*zy - up.y*zx;
		l=Math.sqrt(xx*xx+xy*xy+xz*xz);
		xx/=l;		xy/=l;		xz/=l;
		
		// Cross-product (lookat x right) to get orthogonal right vector
		yx = zy*xz - zz*xy;
		yy = zz*xx - zx*xz;
		yz = zx*xy - zy*xx;
		l=Math.sqrt(yx*yx+yy*yy+yz*yz);
		yx/=l;		yy/=l;		yz/=l;

		l=Math.sqrt(cam.x*cam.x + cam.y*cam.y + cam.z*cam.z);

		// Store the matrix
		viewmat[0].x=xx;	viewmat[0].y=yx;	viewmat[0].z=zx;
		viewmat[1].x=xy;	viewmat[1].y=yy;	viewmat[1].z=zy;
		viewmat[2].x=xz;	viewmat[2].y=yz;	viewmat[2].z=zz;
		viewmat[3].x=0;		viewmat[3].y=0;		viewmat[3].z=l;
	}
	
	function load() {
		if (getl("xangle").value!="") cam.x = parseFloat(getl("xangle").value);
		if (getl("yangle").value!="") cam.y = parseFloat(getl("yangle").value);
		if (getl("zangle").value!="") cam.z = parseFloat(getl("zangle").value);
		getl("xangle").value = cam.x;
		getl("yangle").value = cam.y;
		getl("zangle").value = cam.z;

		curline=0;
		if (timer) { clearTimeout(timer); timer=false; }
		
		canv = getl("canv");
		if (canv && canv.getContext) {
			wid = canv.attributes.width.value;
			hei = canv.attributes.height.value;
			ctx = canv.getContext("2d");
			if (ctx.getImageData) show = true;
		}
		if (!show) {
			pix = new Array();
			wid = getl("canvdiv").clientWidth;
			hei = getl("canvdiv").clientHeight;
			if (!ctx) {
				getl("msg").innerHTML="Use Firefox (3.1 beta preferably), Opera, Safari, Chrome,<br/>or almost any non-IE browser to see the output";
			} else {
				getl("msg").innerHTML="Use Firefox (3.1 beta perferably), Opera 9.60, or latest<br/>Safari/WebKit for textures, and faster rendering";
			}
		}

		wh = wid/2;
		hh = hei/2;

		vw = -eyez * 2 / Math.tan((90-fov/2)*rdn);
		vh = vw * hei/wid;
		fovy = 2 * (90-Math.atan(-eyez/(vh/2))/rdn);
		ivw = vw/wid;
		ivh = vh/hei;

		renderframe();
	}
	
	function refresh() {
		if (curline>0) getl("progress").innerHTML = "Rendering: "+Math.round(curline*100/hei)+"%";
		
		if (show) {
			ctx.putImageData(imgdata, 0,0);
			// Hack to get firefox2 to show the updated canvas
			toggle=1-toggle;
			getl("canvdiv").style.left=toggle+"px";
		} else if (curline==0) {
			//XXX
			var x,y,xy,p=pix;
			for (xy=y=0; y<hei; y++) {
				for (x=0; x<wid; x++,xy+=4) {
					ctx.fillStyle="rgb("+p[xy]+","+p[xy+1]+","+p[xy+2]+")";
					ctx.fillRect(x,y,x+1,y+1);
				}
			}
			getl("progress2").innerHTML = "&nbsp;";
		}
	}


	// Test ray/object intersection. Returns -1 if none, or index of object.
	// Will also find incident point in (ix,iy,iz)
	function intersect() {
		var i;
		mt=99999; mo=-1;

		for (i=0; i<numob; i++) ob[i].intersect(i);
		
		// Incident point & eye vector
		if (mo>=0) {
			ndir = mndir;
			ob[mo].hit(mt);	ez=iz-eyez;
			idoti = ix*ix + iy*iy + iz*iz;
		}
		return mo;
	}
		

	var last_li = new Array();
	var llast;
	
	// see if ray from incident point to the light intersects any object (shadows!)
	function li_intersect(l) {
		var i,last;
		
		// If normal points away from light, point is in shadow of intersected object
		if ((nx*lx+ny*ly+nz*lz)<=0) return true;
			
		ldotl = lx*lx + ly*ly + lz*lz;
		idotl = ix*lx + iy*ly + iz*lz;
		
		last = llast[l];
		if (last>=0 && ob[last].li_intersect()) { return true; }

		for (i=0; i<numob; i++) {
			if (i==last || !ob[i].li_intersect()) continue;
			llast[l] = i;
			return true;
		}
		return false;
	}
	
	
	function shade(obj) {
		var i,j,a,d,p,b,s, ll, rx,ry,rz;
		llast = last_li[level];
		s=ob[obj];
		a=-1;
		cl=0;
		if (ndir<0 && s.inside) s=s.inside;
		if (s.texture) s.texture();
		// sum the lights
		for (i=0; i<numli; i++) {
			// light vector
			lx = li[i].x - ix;
			ly = li[i].y - iy;
			lz = li[i].z - iz;
			// early out if in shadow
			if (li_intersect(i)) continue;

			// distance to light
			ll = 1/Math.sqrt(lx*lx+ly*ly+lz*lz);
			
			// diffuse (lambert) = cos(|normal dot light|)
			d = (nx*lx+ny*ly+nz*lz)*ll;
			if (d<0) d=0; else d*=s.d;
			
			// light reflection vector
			b = 2*(lx*nx+ly*ny+lz*nz);
			rx = b*nx - lx;
			ry = b*ny - ly;
			rz = b*nz - lz;
			
			// phong = cos(|light reflection dot eye|)^n
			if (a<0) a = 1/Math.sqrt(ix*ix + iy*iy + ez*ez);
			p = -(rx*ix+ry*iy+rz*ez)*a*ll;
			if (p<0) { if (d==0) continue; p=0; }
			else { p=Math.pow(p,s.pp)*s.p; }
			
			cl += (d*s.cl + p)*li[i].i;
		}
	}
	
	var pcl,level,rf;
	function cast() {
		var t, obj,o;
		
		iobj = -1;
		level = 0;
		// find closest intersection
		obj = intersect();
		for (o=0; o<numli; o++) { if (li[o].intersect()) obj=numob+o; }
		if (obj>=numob) {
			o = li[obj-numob];	nz=0.5-nz*2;
			pcl+=o.i*nz;
			return true;
		}
		if (obj<0) return false;
		iobj = obj;

		shade(obj);
		t = (ndir<0 && ob[obj].inside) ? ob[obj].inside : ob[obj];
		pcl+=cl+t.cl*amb;
		rf=1;
		
		// recurse reflections
		for (level=1; level<maxlevel; level++) {
			rf *= (ndir<0 && ob[obj].inside) ? ob[obj].inside.rf : ob[obj].rf;
			if (rf<=0) break;
			// calculate reflected ray
			t = 2*(nx*r.dx + ny*r.dy + nz*r.dz);
			r.ox = ix;		r.oy = iy;		r.oz = iz;
			r.dx-= t*nx;	r.dy-= t*ny;	r.dz-= t*nz;
			// some dot-prods
			r.odotd = r.ox*r.dx + r.oy*r.dy + r.oz*r.dz;
			r.odoto = r.ox*r.ox + r.oy*r.oy + r.oz*r.oz;

			// find closest intersection
			obj = intersect(obj);
			if (obj<0) break;
			iobj = obj;
			shade(obj);
			
			pcl+=cl*rf;
		}
		//if (level>=20) { pcr=pcg=pcb=1; }
		
		return true;
	}
	
	var curline = 0;
	var timer = null;
	var start;
	var anim=true;
	
	function renderframe() {
		var i;
		if (curline>0) return;
		curline = 0;
		
		//cam.x = sin*300;
		//cam.y = 0;
		//cam.z = -cos*300;

		if (scene()) startframe();
		// else startframe() will be called back when pending images have loaded
	}
	
	var updatetimer=true;
	function startframe() {
		if (show && !imgdata) {
			ctx.fillRect(0,0, wid,hei);
			imgdata = ctx.getImageData(0,0,wid,hei);
			pix = imgdata.data;
		} 

		getl("progress").innerHTML = "Rendering: 0%";
		start = new Date();
		updatetimer=setInterval("refresh()", 500);
		setTimeout("tick()", 1);
	}

	function tick() {
		var x,y, ll=0,d,xa,ya;
		var num=0;

		if (!antialias) {
			pcl=0;
			for (xy=curline*wid*4, y=curline-hh; y<hh && num<2; y++,num++,curline++) {
				for (x=-wh; x<wh; x++,xy+=4) {
					r.ox = r.dx = ivw*x;
					r.oy = r.dy = -ivh*y;
					r.oz = 0;	r.dz = -eyez;
					r.odoto = r.odotd = r.ox*r.ox + r.oy*r.oy;
					r.ddotd = r.odoto + r.dz*r.dz;
					
					if (!cast()) {
						pix[xy]=pix[xy+1]=pix[xy+2]=0;
						continue;
					}
					pix[xy]=(pcl>1)?255:(pcl*255|0);
					pix[xy+1]=pix[xy];
					pix[xy+2]=pix[xy];
					pcl=0;
				}
			}
		} else {
			for (xy=curline*wid*4, y=curline-hh; y<hh && num<2; y++,num++,curline++) {
				for (x=-wh; x<wh; x++,xy+=4) {
					pcl=0;
					r.ox=r.dx=(x-0.25)*ivw;	r.oy=r.dy=(-y-0.25)*ivh;	r.oz=0;	r.dz=-eyez;
					r.odotd=r.odoto=r.ox*r.ox+r.oy*r.oy;	r.ddotd=r.odoto+eyez2;	cast();
//					R=lr-pcr; G=lg-pcg; B=lb-pcb; d=R*R+G*G+B*B;
//					if (d>0.5) {
						r.ox=r.dx=(x+0.25)*ivw;	r.oy=r.dy=(-y-0.25)*ivh;	r.oz=0;	r.dz=-eyez;
						r.odotd=r.odoto=r.ox*r.ox+r.oy*r.oy;	r.ddotd=r.odoto+eyez2;	cast();
						r.ox=r.dx=(x-0.25)*ivw;	r.oy=r.dy=(-y+0.25)*ivh;	r.oz=0;	r.dz=-eyez;
						r.odotd=r.odoto=r.ox*r.ox+r.oy*r.oy;	r.ddotd=r.odoto+eyez2;	cast();
						r.ox=r.dx=(x+0.25)*ivw;	r.oy=r.dy=(-y+0.25)*ivh;	r.oz=0;	r.dz=-eyez;
						r.odotd=r.odoto=r.ox*r.ox+r.oy*r.oy;	r.ddotd=r.odoto+eyez2;	cast();
						pix[xy]=(pcl>4)?255:(pcl*63.75|0);
						pix[xy+1]=pix[xy];
						pix[xy+2]=pix[xy];
//					} else {
//						pix[xy]=(pcr>1)?255:(pcr*255|0);
//						pix[xy+1]=(pcg>1)?255:(pcg*255|0);
//						pix[xy+2]=(pcb>1)?255:(pcb*255|0);
//					}
//					lr=pcr; lg=pcg; lb=pcb;
				}
			}
		}
		
		if (curline<hei) {
			timer = setTimeout("tick()", 0);
		} else {
			if (updatetimer) { clearInterval(updatetimer); updatetimer=false; }
			var end = new Date();
			getl("progress").innerHTML = framenum+" Time: "+(end.getTime()-start.getTime())+"ms";
			curline = 0;
			if (ctx && !show) {
				getl("progress2").innerHTML += "Plotting...";
				setTimeout("refresh();", 100);
			} else
				refresh();
				
			framenum++;
			
			if (anim) {
				timer = setTimeout("renderframe()", 1);
			}
		}
	}
	
	


	/*************************************
	 * UI Stuffs
	 */

	function hun(x) { return Math.round(x*100)/100; }
	function randomview() {
		var a = Math.random()*2*3.141592654,
			e = Math.random()*300 - 30,
			r = 50 + Math.random()*350;
		cam.x = Math.round(r * Math.sin(a) * 10)/10;
		cam.z = Math.round(r * Math.cos(a) * 10)/10;
		cam.y = Math.round(e * 10)/10;

		//getl("dbg").innerHTML = "x:"+hun(cam.x)+", y:"+hun(cam.y)+", z:"+hun(cam.z);
		getl("xangle").value = cam.x;
		getl("yangle").value = cam.y;
		getl("zangle").value = cam.z;

		//anim = !anim;	if (anim)
		//load();
	}
	

	function changesize() {
		var x,y;
		switch (getl("sizesel").value) {
		case "100x80" :		x=100;	y=80;	break;
		case "200x160":		x=200;	y=160;	break;
		case "320x256":		x=320;	y=256;	break;
		case "400x320":		x=400;	y=320;	break;
		case "500x400":		x=500;	y=400;	break;
		case "640x512":		x=640;	y=512;	break;
		case "800x640":		x=800;	y=640;	break;
		case "1200x960":	x=1200;	y=960;	break;
		case "1680x1050":	x=1680;	y=1050;	break;
		default:return;
		}

		var div = getl("canvdiv");
		div.style.width = x+"px";
		div.style.height= y+"px";
		
		var canv = getl("canv");
		if (canv && canv.getContext) {
			canv.attributes.width.value = x;
			canv.attributes.height.value = y;
			canv.width = x;
			canv.height = y;
			imgdata = false;
		}
		load();
	}
	
	function changeaa() { antialias = getl("aacheck").checked; }
