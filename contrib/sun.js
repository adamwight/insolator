// JavaScript by Peter Hayes http://www.aphayes.pwp.blueyonder.co.uk/
// Copyright 2001-2009
// This code is made freely available but please keep this notice.
// I accept no liability for any errors in my coding but please
// let me know of any errors you find. My address is on my home page.
// Adapted for insolator Adam Wight 2011

// Various functions for the Sun

// Nutation in longitude and obliquity, returns seconds

function nutation(obs) {
  var T=(jd(obs)-2451545.0)/36525.0;
  var T2=T*T;
  var T3=T2*T;
  var omega=rev(125.04452-1934.136261*T);
  var L=rev(280.4665+36000.7698*T);
  var LP=rev(218.3165+481267.8813*T);
  var deltaL=-17.20*sind(omega)-1.32*sind(2*L)-0.23*sind(2*LP)+0.21*sind(2*omega);
  var deltaO=9.20*cosd(omega)+0.57*cosd(2*L)+0.10*cosd(2*LP)-0.09*cosd(2*omega);
  return new Array(deltaL,deltaO);
}

// Obliquity of ecliptic

function obl_eql(obs) {
  var T=(jd(obs)-2451545.0)/36525;
  var T2=T*T;
  var T3=T2*T;
  var e0=23.0+(26.0/60.0)+(21.448-46.8150*T-0.00059*T2+0.001813*T3)/3600.0;
  var nut=nutation(obs);
  var e=e0+nut[1]/3600.0;
  return e;
}

// Eccentricity of Earths Orbit

function earth_ecc(obs) {
  var T=(jd(obs)-2451545.0)/36525;
  var T2=T*T;
  var T3=T2*T;
  var e=0.016708617-0.000042037*T-0.0000001236*T2;
  return e;
}

// The equation of time function returns minutes

function EoT(obs) {
  var sun_xyz=new Array(0.0,0.0,0.0);
  var earth_xyz=helios(planets[2],obs);
  var radec=radecr(sun_xyz,earth_xyz,obs);
  var T=(jd(obs)-2451545.0)/365250;
  var T2=T*T;
  var T3=T2*T;
  var T4=T3*T;
  var T5=T4*T;
  var L0=rev(280.4664567+360007.6982779*T+0.03032028*T2+
             T3/49931.0-T4/15299.0-T5/1988000.0);
  var nut=nutation(obs);
  var delta=nut[0]/3600.0;
  var e=obl_eql(obs);
  var E=4*(L0-0.0057183-(radec[0]*15.0)+delta*cosd(e));
  while (E < -1440) E+=1440;
  while (E > 1440) E-=1440;
  return E;
}

function get_sun(observer)
{
  var i;
  var obscopy=new Object(); for (var i in observer) obscopy[i] = observer[i];
  var sun_xyz=new Array(0.0,0.0,0.0);
  var lastdst=checkdst(obscopy);
  obscopy.day=1;
  var firstdst=checkdst(obscopy);
  if (firstdst!=lastdst) {
     obscopy.tz+=(firstdst-lastdst);
     lastdst=firstdst;
     //writeln("<TR><TH colspan=\"14\">Daylight savings setting corrected</TH></TR>");
  }
  var earth_xyz=helios(planets[2],obscopy);
  var radec=radecr(sun_xyz,earth_xyz,obscopy);
  var altaz=radtoaa(radec[0],radec[1],obscopy);
  return altaz;
}

// rewrite1 updates table1 date/time info

function rewrite1() {
  with (document.table1) {
    place_name.value=observer.name;
    local_date.value=datestring(observer);
    civil_time.value=timestring(observer,false);
    var uts=UTstring(observer);
    // equation of time
    var obscopy=new Object();
    for (var i in observer) obscopy[i] = observer[i];
    obscopy.month=1;
    obscopy.day=1;
    var dd=jd0(observer.year,observer.month,observer.day)-
           jd0(obscopy.year,obscopy.month,obscopy.day)+1;
    var b=360.0*(dd-81)/365.0;
    // local time
    var lts=timestring(observer,true);
  }
}

// reset1 restores the tables to their default settings

function reset1(now) {
  // The observatory object holds local date and time,
  // timezone correction in minutes with daylight saving if applicable,
  // latitude and longitude
  observer=new observatory(atlas[0],now);
  
  with (document.table1) {
    Place.selectedIndex=0;
    if (argstr.length > 1) {
      // Location information passed by URL.
      // Name is the name of the observers location
      // Lat and Long are the latitude & longitude in degrees
      // west is positive using Meeus's convention which conflicts with a
      // 1982 IAU decision. We will use the IAU convention of EAST being
      // POSITIVE for the query string and change accordingly
      // TZ is in hours again with east positive and converted internally
      // into minutes and sign reversed
      var args = argstr.split('&');
      var Name="Unknown";
      var Lat=90.0;
      var Lon=360.0;
      var TZ=24;
      var DST=false;
      var DSTseen=(argstr.indexOf("DST=") != -1) ? true : false;
      Place.selectedIndex=Place.options.length-1;
      for (var i=0; i<args.length; i++) eval(unescape(args[i]));
      var pattern = new RegExp(".*"+Name+".*");
      for (var i = 0 ; i < atlas.length ; i++) {
        if (pattern.test(atlas[i].name)) {
          Place.selectedIndex = i;
          observer=new observatory(atlas[i],now);
          break;
        }
      }
      observer.name=Name;
      if (Lat <90.0) observer.latitude=Lat;
      // See note above about longitude and time zone conventions
      if (Lon<360.0) observer.longitude=-Lon;
      if (TZ <=12) { observer.tz=-TZ*60.0; observer.dss=""; observer.dse=""; }
    }
    // Processed parameters passed by search string start to update table1
    Latitude.value=llstring(observer.latitude);
    North.options[(observer.latitude>=0.0)?0:1].selected=true;
    Longitude.value=llstring(observer.longitude);
    West.options[(observer.longitude>=0.0)?0:1].selected=true;
    month_length[1]=leapyear(observer.year)?29:28;
    //XXX if (dst_check.checked) observer.tz-=60.0;
    var PCtime=now.getTime();  // ms since Jan 1 1970
    var PCoffset=now.getTimezoneOffset()*60000;
    // Calculate what PCtime would be for the observer
    PCtime=PCtime+PCoffset-(observer.tz*60000);
    var nd=new Date(PCtime);
    observer.year = nd.getFullYear();
    observer.month = nd.getMonth()+1;
    observer.day = nd.getDate();
    observer.hours = nd.getHours();
    observer.minutes = nd.getMinutes();
    observer.seconds = nd.getSeconds();
  }
  rewrite1();
}
