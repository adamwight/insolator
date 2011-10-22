/******************************
 * Simple Javascript Raytracer example,
 * 2008/10/20 - mark.webster@gmail.com
 * Feel free to do whatever you want with this source.
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
		cr,cg,cb;	// ray's accumulated colour (will be pixel)

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
	 * Sphere definition
	 */
	// (x,y,z)=centre, r=radius
	function sphere(x,y,z,r, cr,cg,cb, d,p,pp,rf) {
		sp[numsp] = new Object();
		var s = sp[numsp];
		s.x =x;  s.y =y;  s.z =z;   s.r=r;
		s.cr=cr; s.cg=cg; s.cb=cb;
		s.d =d;  s.p =p;  s.pp=pp;	s.rf=rf;

		s.precalc = function() {
			this.ir = 1/this.r;
			this.c = this.x*this.x + this.y*this.y + this.z*this.z - this.r*this.r;
		};
		s.sethalf = function(nx,ny,nz, cr,cg,cb, d,p,pp,rf) {
			// Set hemisphere, normal points in direction of open half.
			// Inside has different material properties.
			this.nx=nx;	this.ny=ny;	this.nz=nz;
			this.inside = {
				x:this.x,	y:this.y,	z:this.z,	r:this.r,
				nx:nx, ny:ny, nz:nz,
				obj:this.obj+'inside', parent:this,
				cr:cr, cg:cg, cb:cb, d:d, p:p, pp:pp, rf:rf,
				precalc:this.precalc, setuv:this.setuv, getuv:this.getuv,
				setbitmap:this.setbitmap, texture:function(){} };
			return this.inside;
		}
		s.setuv = function(ux,uy,uz, vx,vy,vz, uo,vo, texturefunc) {
			var l,v,wx,wy,wz;
			this.ocr=this.cr;	this.ocg=this.cg;	this.ocb=this.cb;
			this.ul = l = Math.sqrt(ux*ux+uy*uy+uz*uz);	ux/=l;	uy/=l;	uz/=l;
			this.vl = l = Math.sqrt(vx*vx+vy*vy+vz*vz);	vx/=l;	vy/=l;	vz/=l;
			
/*			if (this.nx!=undefined) {
				// if half-sphere, then attempt to align uv axes with the axis (nx,ny,nz)
				v = vx*this.nx + vy*this.ny + vz*this.nz;
				wx=uy*vz-uz*vy;	wy=uz*vx-ux*vz;	wz=ux*vy-uy*vx;
				vx = this.nx*v;			vy = this.ny*v;			vz = this.nz*v;
				ux = vy*wz-vz*wy;		uy = vz*wx-vx*wz;		uz = vx*wy-vy*wx;
				alert(hun(ux)+","+hun(uy)+","+hun(uz)+" || "+hun(vx)+","+hun(vy)+","+hun(vz));
			}*/
			this.wx=uy*vz-uz*vy;	this.wy=uz*vx-ux*vz;	this.wz=ux*vy-uy*vx;
			
			this.ux=ux;	this.uy=uy;	this.uz=uz;	this.vx=vx;	this.vy=vy;	this.vz=vz;
			this.uo=uo;	this.vo=vo;	this.texture = texturefunc;
			return this;
		}
		s.setbitmap = function(imgurl) { setbitmap(this, imgurl); return this; }
		s.texture = function(){};

		s.hit = sp_hit;
		s.intersect = sp_intersect;
		s.li_intersect = sp_li_intersect;
		s.getuv = function() {
			var x,y,z,u,v,r;
			x = ix-this.x;	y = iy-this.y;	z = iz-this.z;
			v = Math.acos(-(x*this.vx+y*this.vy+z*this.vz)*this.ir);
			u = (x*this.ux+y*this.uy+z*this.uz)/(this.r*Math.sin(v));
			this.u = this.uo + Math.acos(u)/6.2831853072;
			this.v = this.vo + v/3.1415926536;
			if ((x*this.wx+y*this.wy+z*this.wz)<0) this.u=1-this.u;
			this.u *= this.ul;
			this.v *= this.vl;
		}
		
		s.precalc();
		s.obj = numob;
		ob[numob++] = s;
		numsp++;
		return s;
	}

		// Sphere intersect
		function sp_intersect() {
			var self, b,b2,c,d, t;
			self=(this.obj==iobj);
			// Convex object can't reflect itself on the outside
			if (self && (this.nx==undefined || ndir>0)) return;
			
			b = this.x*r.dx + this.y*r.dy + this.z*r.dz - r.odotd;
			b2= b*b;
			c = r.odoto - 2*(this.x*r.ox + this.y*r.oy + this.z*r.oz) + this.c;
			d = b2 - r.ddotd*c;
			if (d<0) return;
			if (this.nx==undefined) {		// Closed sphere
				if (b<0) {
					if (b2>d) return;		// both roots <0
					t=(b+Math.sqrt(d))/r.ddotd;
				} else {
					if (b2>d) t=(b-Math.sqrt(d))/r.ddotd; else t=(b+Math.sqrt(d))/r.ddotd;
				}
				if (t>0 && t<mt) { mt=t; mo=this.obj; mndir=1; }
				return;
			}
			// Open sphere
			d = Math.sqrt(d);
			// Try near first if not testing self
			if (!self) {
				t = (b-d)/r.ddotd;
				if (t>0 && t<mt) {
					if (((r.ox+r.dx*t-this.x)*this.nx + (r.oy+r.dy*t-this.y)*this.ny + (r.oz+r.dz*t-this.z)*this.nz)<=0) {
						mt=t; mo=this.obj; mndir=(b>0)?1:-1;
						return;
					}
				}
			}
			// Now try far
			t = (b+d)/r.ddotd;
			if (t<=0 || t>mt) return;
			if (((r.ox+r.dx*t-this.x)*this.nx + (r.oy+r.dy*t-this.y)*this.ny + (r.oz+r.dz*t-this.z)*this.nz)>0) return;
			mt=t; mo=this.obj; mndir=-1;
		}

		// find incident and normal based on previous sphere intersection
		function sp_hit() {
			// incident point
			ix = r.ox + r.dx*mt;
			iy = r.oy + r.dy*mt;
			iz = r.oz + r.dz*mt;
			// normal
			nx = ndir*(ix - this.x)*this.ir;
			ny = ndir*(iy - this.y)*this.ir;
			nz = ndir*(iz - this.z)*this.ir;
		}

		// Test if ray from incident to light intersects this sphere
		function sp_li_intersect() {
			var self,t, b,b2,c,d;
			self=(this.obj==iobj);
			// Convex object can't shadow itself on the outside
			if (self && (this.nx==undefined || ndir>=0)) return false;
			
			b = this.x*lx + this.y*ly + this.z*lz - idotl;	b2 = b*b;
			c = idoti - 2*(this.x*ix + this.y*iy + this.z*iz) + this.c;
			d = b2 - ldotl*c;
			if (d<0) return false;
			if (this.nx==undefined) {			// Closed sphere
				if (b<0) {
					if (b2>d) return;			// both roots <0
					t = (b+Math.sqrt(d)) / ldotl;
				} else {
					if (b2>d) t = (b-Math.sqrt(d)) / ldotl;
						else t = (b+Math.sqrt(d)) / ldotl;
				}
				return (t>=0 && t<=1);
			}
			// Open sphere
			d = Math.sqrt(d);
			t = (b+d) / ldotl;
			if (t>=0 && t<=1) {
				c = (ix+lx*t-this.x)*this.nx + (iy+ly*t-this.y)*this.ny + (iz+lz*t-this.z)*this.nz;
				if (c<=0) return true;
			}
			if (self) return false;
			t = (b-d) / ldotl;
			if (t<0 || t>1) return false;
			c = (ix+lx*t-this.x)*this.nx + (iy+ly*t-this.y)*this.ny + (iz+lz*t-this.z)*this.nz;
			return (c<=0);
		}
	
	
	/*************************************
	 * Cylinder definition (not infinite)
	 */
	// (x,y,z)=base, (x1,y1,z1)=end, r=radius
	function cylinder(x,y,z, x1,y1,z1, r, cr,cg,cb, d,p,pp,rf) {
		var c = cy[numcy] = new Object();
		c.x =x;  c.y =y;  c.z =z;   c.r=r;
		c.x1=x1; c.y1=y1; c.z1=z1;
		c.cr=cr; c.cg=cg; c.cb=cb;
		c.d =d;  c.p =p;  c.pp=pp;	c.rf=rf;

		c.precalc = function() {
			this.r2 = this.r*this.r;
			this.ir = 1/this.r;
			this.ir2 = 1/this.r2;
			// we don't normalise, because we're using the normal as the axis & length
			this.nx	= this.x1 - this.x;
			this.ny = this.y1 - this.y;
			this.nz = this.z1 - this.z;
			this.len2= this.nx*this.nx + this.ny*this.ny + this.nz*this.nz;
			this.ilen2=1/this.len2;
			this.c = this.len2 * this.r2;
			this.len= Math.sqrt(this.len2);
		};
		c.setinside = function(cr,cg,cb, d,p,pp,rf) {
			// Inside can have different material properties
			this.inside = {
				x:this.x, y:this.y, z:this.z,	x1:this.x1, y1:this.y1, z1:this.z1,
				r:this.r, cr:cr, cg:cg, cb:cb, d:d, p:p, pp:pp, rf:rf,
				obj:this.obj+'inside', parent:this, precalc:this.precalc, texture:function(){},
				setbitmap:this.setbitmap, setuv:this.setuv,	getuv:this.getuv};
			return this.inside;
		}
		c.setuv = function(ux,uy,uz, vx,vy,vz, uo,vo, texturefunc) {
			var l;
			this.ocr=this.cr;	this.ocg=this.cg;	this.ocb=this.cb;
			this.ul = l = Math.sqrt(ux*ux+uy*uy+uz*uz);	ux/=l;	uy/=l;	uz/=l;
			this.vl = l = Math.sqrt(vx*vx+vy*vy+vz*vz);	vx/=l;	vy/=l;	vz/=l;
			this.ux=ux;	this.uy=uy;	this.uz=uz;	this.vx=vx;	this.vy=vy;	this.vz=vz;
			this.wx=uy*vz-uz*vy;	this.wy=uz*vx-ux*vz;	this.wz=ux*vy-uy*vx;
			this.uo=uo;	this.vo=vo;	this.texture = texturefunc;
			return this;
		}
		c.setbitmap = function(imgurl) { setbitmap(this, imgurl); return this; }
		c.texture = function(){};

		c.hit = cy_hit;
		c.intersect = cy_intersect;
		c.li_intersect = cy_li_intersect;
		c.getuv = function() {
			var x,y,z,cx,cy,cz;
			cx=this.x+this.nx*icyl;	cy=this.y+this.ny*icyl;	cz=this.z+this.nz*icyl;
			x=ix-cx;	y=iy-cy;	z=iz-cz;
			this.u = Math.acos((x*this.ux+y*this.uy+z*this.uz)*this.ir)/6.2831853072;
			if ((x*this.wx+y*this.wy+z*this.wz)<0) this.u=1-this.u;
			this.u = (this.u+this.uo) * this.ul;
			this.v = (1-icyl-this.vo) * this.vl;
		}
		
		c.precalc();
		c.obj = numob;
		ob[numob++] = c;
		numcy++;
		return c;
	}
		
		function cy_intersect() {
			var self,t, a,b,b2,c,d, px,py,pz, onx,ony,onz, dnx,dny,dnz, cix,ciy,ciz;
			self=(this.obj==iobj);
			if (self && ndir>=0) return;	// Convex object can't reflect itself on the outside
			
			px  = this.x - r.ox;				py  = this.y - r.oy;				pz  = this.z - r.oz;
			onx = py*this.nz - pz*this.ny;		ony = pz*this.nx - px*this.nz;		onz = px*this.ny - py*this.nx;
			dnx = r.dy*this.nz - r.dz*this.ny;	dny = r.dz*this.nx - r.dx*this.nz;	dnz = r.dx*this.ny - r.dy*this.nx;
			a   = dnx*dnx + dny*dny + dnz*dnz;	b   = onx*dnx + ony*dny + onz*dnz;	b2  = b*b;
			d   = b2 - (onx*onx + ony*ony + onz*onz - this.c)*a;
			if (d<0) return;
			if (b<0 || self) {				// If testing self, test only for far intersect
				t = (b+Math.sqrt(d))/a;
				if (t<0 || t>mt) return;	// Intersection behind incident or beyond current nearest
				cix= r.ox + r.dx*t;	ciy = r.oy + r.dy*t;	ciz = r.oz + r.dz*t;
				px = cix - this.x;	py  = ciy - this.y;		pz  = ciz - this.z;
				c  = (px*this.nx + py*this.ny + pz*this.nz) * this.ilen2;
				if (c<0 || c>1) return;
				mndir = -1;
			} else {
				d = Math.sqrt(d);
				t = (b-d)/a;
				if (t>mt) return;
				if (t>=0) {	// Closer intersection
					cix= r.ox + r.dx*t;	ciy = r.oy + r.dy*t;	ciz = r.oz + r.dz*t;
					px = cix - this.x;	py  = ciy - this.y;		pz  = ciz - this.z;
					c  = (px*this.nx + py*this.ny + pz*this.nz) * this.ilen2;
					if (c>=0 && c<=1) mndir=1; else t=-1;
				}
				if (t<0) {
					t = (b+d)/a;
					if (t>mt) return;
					cix= r.ox + r.dx*t;	ciy = r.oy + r.dy*t;	ciz = r.oz + r.dz*t;
					px = cix - this.x;	py  = ciy - this.y;		pz  = ciz - this.z;
					c  = (px*this.nx + py*this.ny + pz*this.nz) * this.ilen2;
					if (c<0 || c>1) return;
					mndir =-1;
				}
			}

			ix=cix;	iy=ciy;	iz=ciz;
			icyl = c;		mt=t;
			mo=this.obj;	mndir *= this.ir;
		}
		
		function cy_hit() {
			nx = ndir * (ix - (this.x + this.nx*icyl));
			ny = ndir * (iy - (this.y + this.ny*icyl));
			nz = ndir * (iz - (this.z + this.nz*icyl));
		}
		
		function cy_li_intersect() {
			var t,self, px,py,pz, onx,ony,onz, dnx,dny,dnz, a,b,b2,c,d;
			self=(this.obj==iobj);
			if (self && ndir>=0) return false;	// Convex object can't shadow itself on the outside
			px  = this.x - ix;				py  = this.y - iy;				pz  = this.z - iz;
			onx = py*this.nz - pz*this.ny;	ony = pz*this.nx - px*this.nz;	onz = px*this.ny - py*this.nx;
			dnx = ly*this.nz - lz*this.ny;	dny = lz*this.nx - lx*this.nz;	dnz = lx*this.ny - ly*this.nx;
			a   = dnx*dnx+dny*dny+dnz*dnz;	b   = onx*dnx+ony*dny+onz*dnz;	b2  = b*b;
			d   = b2 - (onx*onx + ony*ony + onz*onz - this.c)*a;
			if (d<0) return false;
			if (b<0 || self) {					// If testing self, test only for far intersect
				t = (b+Math.sqrt(d)) / a;
				if (t<0 || t>1) return false;	// Intersection behind incident or beyond light
				cix = ix + lx*t;	ciy = iy + ly*t;	ciz = iz+lz*t;
				px  = cix - this.x;	py  = ciy - this.y;	pz  = ciz - this.z;
				c   = (px*this.nx + py*this.ny + pz*this.nz) * this.ilen2;
				return (c>=0 && c<=1);
			}
			d = Math.sqrt(d);
			t = (b-d)/a;
			if (t>1) return false;
			if (t>=0) {	// Closer intersection
				cix = ix + lx*t;	ciy = iy + ly*t;	ciz = iz+lz*t;
				px  = cix - this.x;	py  = ciy - this.y;	pz  = ciz - this.z;
				c   = (px*this.nx + py*this.ny + pz*this.nz) * this.ilen2;
				if (c>=0 && c<=1) return true;
			}
			t = (b+d)/a;
			if (t>1) return false;
			cix = ix + lx*t;	ciy = iy + ly*t;	ciz = iz+lz*t;
			px  = cix - this.x;	py  = ciy - this.y;	pz  = ciz - this.z;
			c   = (px*this.nx + py*this.ny + pz*this.nz) * this.ilen2;
			return (c>=0 && c<=1);
		}

		
	/*************************************
	 * Infinite plane definition
	 */
	// (x0,y0,z0)-(x1,y1,z1)-(x2,y2,z2) = co-planar point (counter-clockwise)
	function plane(x0,y0,z0, x1,y1,z1, x2,y2,z2, cr,cg,cb, d,ph,pp,rf) {
		pl[numpl] = new Object();
		var p = pl[numpl];
		var nx,ny,nz,l;
		
		p.x=x0;		p.y=y0;		p.z=z0;
		p.ux=x1-x0;	p.uy=y1-y0;	p.uz=z1-z0;
		p.vx=x2-x0;	p.vy=y2-y0;	p.vz=z2-z0;
		p.cr=cr;	p.cg=cg;	p.cb=cb;	p.d=d;
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
			this.ocr=this.cr;	this.ocg=this.cg;	this.ocb=this.cb;
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
	function disc(x,y,z, nx,ny,nz, r, cr,cg,cb, d,ph,pp,rf) {
		pl[numpl] = new Object();
		var p = pl[numpl];
		
		p.x =x;		p.y =y;		p.z =z;
		p.cr=cr;	p.cg=cg;	p.cb=cb;	p.d=d;
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
			this.ocr=this.cr;	this.ocg=this.cg;	this.ocb=this.cb;
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
	function light(x,y,z, r,g,b) {
		li[numli] = new Object();
		var l = li[numli];
		l.x=x;	l.y=y;	l.z=z;
		l.r=r;	l.g=g;	l.b=b;
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
		i = (this.v*this.bmpw + this.u)*3;
		this.cr = this.bmp[i]*this.ocr;
		this.cg = this.bmp[i+1]*this.ocg;
		this.cb = this.bmp[i+2]*this.ocb;
	}
	
	function tilebitmap_bi() {
		var i,u,v,fu,fv,f,r,g,b,p;
		this.getuv();
		fu = (this.u*this.bmpw)%this.bmpw;	if (fu<0) fu+=this.bmpw;
		fv = (this.v*this.bmph)%this.bmph;	if (fv<0) fv+=this.bmph;
		u = fu|0;	fu-=u;	v = fv|0;	fv-=v;
		
		p = this.bmp;		i=(v*this.bmpw+u)*3;	f=(1-fu)*(1-fv);
		r=p[i]*f;	g=p[i+1]*f;		b=p[i+2]*f;
		
		u=(u+1)%this.bmpw;	i=(v*this.bmpw+u)*3;	f=fu*(1-fv);
		r+=p[i]*f;	g+=p[i+1]*f;	b+=p[i+2]*f;
		
		v=(v+1)%this.bmph;	i=(v*this.bmpw+u)*3;	f=fu*fv;
		r+=p[i]*f;	g+=p[i+1]*f;	b+=p[i+2]*f;
		
		u=(u-1)%this.bmpw;	i=(v*this.bmpw+u)*3;	f=(1-fu)*fv;
		r+=p[i]*f;	g+=p[i+1]*f;	b+=p[i+2]*f;
		
		this.cr = r*this.ocr;
		this.cg = g*this.ocg;
		this.cb = b*this.ocb;
	}
	
	function bitmap() {
		var i;
		this.getuv();
		this.u = (this.u*this.bmpw)|0;
		this.v = (this.v*this.bmph)|0;
		if (this.u<0 || this.v<0 || this.u>=this.bmpw || this.v>=this.bmph) {
			this.cr=this.ocr;	this.cg=this.ocg;	this.cb=this.ocb;
		} else {
			i = (this.v*this.bmpw + this.u)*3;
			this.cr = this.bmp[i]*this.ocr;
			this.cg = this.bmp[i+1]*this.ocg;
			this.cb = this.bmp[i+2]*this.ocb;
		}
	}
	
	function bitmap_bi() {
		var i,u,v,fu,fv,f,r,g,b,p;
		this.getuv();
		p = this.bmp;
		fu = this.u*this.bmpw;	u = fu|0;	fu-=u;
		fv = this.v*this.bmph;	v = fv|0;	fv-=v;
		i = (v*this.bmpw+u)*3;	f = (1-fu)*(1-fv);
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { r=f;  g=f;  b=f; }
		else { r=p[i]*f;	g=p[i+1]*f;	b=p[i+2]*f; }
		u++; i+=3; f = fu*(1-fv);
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { r+=f; g+=f; b+=f; }
		else { r+=p[i]*f;	g+=p[i+1]*f;	b+=p[i+2]*f; }
		v++; i+=this.bmpw*3; f = fu*fv;
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { r+=f; g+=f; b+=f; }
		else { r+=p[i]*f;	g+=p[i+1]*f;	b+=p[i+2]*f; }
		u--; i-=3; f = (1-fu)*fv;
		if (u<0||v<0||u>=this.bmpw||v>=this.bmph) { r+=f; g+=f; b+=f; }
		else { r+=p[i]*f;	g+=p[i+1]*f;	b+=p[i+2]*f; }
		
		this.cr = r*this.ocr;
		this.cg = g*this.ocg;
		this.cb = b*this.ocb;
	}
	
	function envmap() {
		var i,u,v;
		u = (this.bmpwh + nx*this.bmpwh)|0;
		v = (this.bmphh - ny*this.bmphh)|0;
		i = (v*this.bmpw + u)*3;
		this.cr = this.bmp[i]*this.ocr;
		this.cg = this.bmp[i+1]*this.ocg;
		this.cb = this.bmp[i+2]*this.ocb;
	}
	
	function chequer1() {
		var u,v,i;
		this.getuv();
		u = Math.floor(this.u);
		v = Math.floor(this.v);
		i = (u^v)&1;
		this.cr=this.cg=i; this.cb=1-i;
	}
	function chequer2() {
		var u,v,i;
		this.getuv();
		u = Math.floor(this.u);
		v = Math.floor(this.v);
		this.cr=this.cg=this.cb=(u^v)&1;
	}

	function swirl() {
		var u;
		this.getuv();
		u = (this.u + this.v*this.vl)%this.ul;
		if (u>=0 && u<this.ul*0.33) {
			this.cr = this.cg = this.cb = 1;
		} else {
			this.cr = this.cg = this.cb = 0.5;
		}
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
					b[j++]=pix[i++]/255;	b[j++]=pix[i++]/255;	b[j++]=pix[i++]/255;
				}
			} else {
				o.bmp = new Array();
				for (var i=0; i<w*h*3; i++) o.bmp[i]=0.5;
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

		sphere(  60,   0,   0, 70, 0.1,0.1,0.1, 0.5,1.0,64, 1.0);	// white sphere
		sphere( -40, -45,-130, 25, 1,0,0, 1.0,1.0, 8, 0.6).			// red sphere
			setuv(1,0,0, 0,1,0, 0,0, tilefunc).setbitmap("textures/onix-pina.jpg");
		sphere( -70, -20,   0, 50, 0,1,0, 0.5,1.0,16, 0.5).			// green sphere
			sethalf(0.25,1,-0.25, 0.3,0.5,0.3, 0.5,1.0,32, 0.8);
		sphere(  95, -50,-125, 20, 0,0,1, 0.8,0.7,16, 0.6);			// blue sphere
	
//		plane(0,-70,0, 0,-70,-100, -200,-70,0, 1,1,1, 0.6,1.0,32, 0.4);
			//setuv(300,0,0, 0,0,300, 0,0, tilefunc).setbitmap("textures/onix-pina.jpg");
		
		disc(0,60,140,	0,0,-1,		150, 1,1,1, 0.5,1.0,64, 0.6).		// far
			setuv(300,0,0, 0,300,0, 0.5,0.5, bitfunc).setbitmap("textures/onix-pina.jpg");
		disc(0,-70,0,	0,1,0,		230, 1,1,1, 0.6,1.0,64, 0.4).		// bottom
			setuv(300,0,0, 0,0,300, 0,0, tilefunc).setbitmap("textures/onix-pina.jpg");
		disc(-150,0,-50, 1,0.2,-0.2, 70, 0,0,0, 0.5,1.0,32, 0.2).		// left
			setuv(0,20,0, 0,0,20, 0,0,	chequer1);
		disc(150,0,-50, -1,0.2,-0.2, 70, 0,0,0, 0.5,1.0,32, 0.4).		// right
			setuv(0,20,0, 0,0,20, 0,0,	chequer2);

		//cylinder(0,-50,-50, 40,-50,-160, 20, 1,1,0, 0.5,1.0,32, 0.5);
		cylinder(20,-70,-110, 20,-20,-110, 30, 1,1,1, 0.6,1.0,32, 0.25).
			setuv(-3,0,0, 0,1,0, 0,0, tilefunc).
			setbitmap("textures/onix-pina.jpg").//marble-grn-1.jpg
			setinside(0.35,0.35,0.35, 0.5,1.0,32, 1.0).
			setuv(10,0,0, 0,6,0, 0,0, swirl);


		light( 180, 80, -80, 1.0,1.0,1.0);	// white light
		light(-140,   0,-180, 1.0,0.2,1.0);	// purple light
		light(   0, 120,-240, 0.6,0.6,0.6);

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
		cr=cg=cb=0;
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
			
			cr += (d*s.cr + p)*li[i].r;
			cg += (d*s.cg + p)*li[i].g;
			cb += (d*s.cb + p)*li[i].b;
		}
	}
	
	var pcr,pcg,pcb,level,rf;
	function cast() {
		var t, obj,o;
		
		iobj = -1;
		level = 0;
		// find closest intersection
		obj = intersect();
		for (o=0; o<numli; o++) { if (li[o].intersect()) obj=numob+o; }
		if (obj>=numob) {
			o = li[obj-numob];	nz=0.5-nz*2;
			pcr+=o.r*nz;	pcg+=o.g*nz;	pcb+=o.b*nz;
			return true;
		}
		if (obj<0) return false;
		iobj = obj;

		shade(obj);
		t = (ndir<0 && ob[obj].inside) ? ob[obj].inside : ob[obj];
		pcr+=cr+t.cr*amb;
		pcg+=cg+t.cg*amb;
		pcb+=cb+t.cb*amb;
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
			
			pcr+=cr*rf;	pcg+=cg*rf;	pcb+=cb*rf;
		}
		//if (level>=20) { pcr=pcg=pcb=1; }
		
		return true;
	}
	
	var curline = 0;
	var timer = null;
	var start;
	var anim=false;
	
	function renderframe() {
		var i;
		if (curline>0) return;
		curline = 0;
		
/*		var ang = (framenum*15)*3.141592654/180;
		ang = Math.sin(ang*3.141592654/2);
		var sin = Math.sin(ang),
			cos = Math.cos(ang);
		cam.x = 0;
		cam.y = sin*300;
		cam.z = 1 - (cos)*300;
		//cam.x = sin*300;
		//cam.y = 0;
		//cam.z = -cos*300;*/

		if (scene()) startframe();
		// else startframe() will be called back when pending images have loaded
	}
	
	var updatetimer=false;
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
		var x,y, lr=0,lg=0,lb=0,R,G,B,d,xa,ya;
		var num=0;

		if (!antialias) {
			pcr=pcg=pcb=0;
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
					pix[xy]=(pcr>1)?255:(pcr*255|0);
					pix[xy+1]=(pcg>1)?255:(pcg*255|0);
					pix[xy+2]=(pcb>1)?255:(pcb*255|0);
					pcr=pcg=pcb=0;
				}
			}
		} else {
			for (xy=curline*wid*4, y=curline-hh; y<hh && num<2; y++,num++,curline++) {
				for (x=-wh; x<wh; x++,xy+=4) {
					pcr=pcg=pcb=0;
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
						pix[xy]=(pcr>4)?255:(pcr*63.75|0);
						pix[xy+1]=(pcg>4)?255:(pcg*63.75|0);
						pix[xy+2]=(pcb>4)?255:(pcb*63.75|0);
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
