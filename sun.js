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
    //writeln("<br>Date = "+datestring(obscopy));
    //writeln(" Time = "+timestring(obscopy,false)+"</h2>");
    //writeln("<td align=center>Right Ascension</td>");
    //writeln("<td align=center>Declination</td>");
    //writeln("<td align=center>Altitude</td>");
    //writeln("<td align=center>Azimuth</td>");
    //writeln("<td align=center>Earth Distance</td>");
    //writeln("<TD colspan=2 align=center>Sun Rise/Set</TD>");
    //writeln("<TD colspan=2 align=center>Civil Dawn/Dusk</TD>");
    //writeln("<TD colspan=2 align=center>Nautical Dawn/Dusk</TD>");
    //writeln("<TD colspan=2 align=center>Astronomical Dawn/Dusk</TD>");
      var lastdst=checkdst(obscopy);
        var count=month_length[obscopy.month-1];
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
      //writeln("<TD align=center>"+hmdstring(radec[0])+"</TD>");
      //writeln("<TD align=center>"+anglestring(radec[1],false)+"</TD>");
      //writeln("<TD align=center>"+anglestring(altaz[0],false)+"</TD>");
      //writeln("<TD align=center>"+anglestring(altaz[1],true)+"</TD>");
      //writeln("<TD align=center>"+Math.round(radec[2]*1000.0)/1000.0+"</TD>");
    return altaz;
}

// rewrite1 updates table1 date/time info

function rewrite1() {
  with (document.table1) {
    place_name.value=observer.name;
    local_date.value=datestring(observer);
    civil_time.value=timestring(observer,false);
    if (dst_check.checked==false) {
      ut_offset.value=hmstring(Math.abs(observer.tz/60.0));
    } else {
      ut_offset.value=hmstring(Math.abs((observer.tz+60.0)/60.0));
    }
    julian.value=Math.round(100*jd(observer))/100;
    var uts=UTstring(observer);
    // equation of time
    var obscopy=new Object();
    for (var i in observer) obscopy[i] = observer[i];
    obscopy.month=1;
    obscopy.day=1;
    var dd=jd0(observer.year,observer.month,observer.day)-
           jd0(obscopy.year,obscopy.month,obscopy.day)+1;
    var b=360.0*(dd-81)/365.0;
    // equation of time in minutes
    var eot=EoT(observer);
    // local time
    var lts=timestring(observer,true);
    // If you change the times menu change this
    // UT
    if (sel_time_opt.options[0].selected) {
      sel_time.value=uts;
    }
    // local time
    if (sel_time_opt.options[1].selected) {
      sel_time.value=lts;
    }
    // solar time
    if (sel_time_opt.options[2].selected) {
      var st=parsecol(lts)+eot/60.0;
      if (dst_check.checked) st=st-1;
      if (st < 0.0) st=24.0+st;
      sel_time.value=hmsstring(st);
    }
    // local sidereal time
    if (sel_time_opt.options[3].selected) {
      var lstn=local_sidereal(observer);
      var lstni=Math.floor(lstn);
      var lsts=((lstni < 10) ? "0" : "") + lstni;
      lstn=60*(lstn-lstni); lstni=Math.floor(lstn);
      lsts+=((lstni < 10) ? ":0" : ":") + lstni;
      lstn=60*(lstn-lstni); lstni=Math.floor(lstn);
      lsts+=((lstni < 10) ? ":0" : ":") + lstni;
      sel_time.value=lsts;
    }
    // If you change the time differences menu change this
    // UTC-Civil
    if (local_diff_opt.options[0].selected) {
      var ld=parsecol(uts)-parsecol(civil_time.value);
      if (ld < 0) ld+=24;
      if (ld > 12) ld-=24;
    }
    // UTC-local time
    if (local_diff_opt.options[1].selected) {
      var ld=parsecol(uts)-parsecol(lts);
      if (ld < 0) ld+=24;
      if (ld > 12) ld-=24;
    }
    // Civil-local time
    if (local_diff_opt.options[2].selected) {
      var ld=parsecol(civil_time.value)-parsecol(lts);
    // Can be wrong near midnight, a quick and dirty fix
      if (ld >= 12) ld-=24.0;
      if (ld <= 12) ld+=24.0;
    }
    // Equation of Time
    if (local_diff_opt.options[3].selected) {
      var ld=eot/60.0;
    }
    local_diff.value=hmsstring(ld);
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
    if (observer.tz>=0) {
      TZ_WE.options[0].selected=true;
    } else {
      TZ_WE.options[1].selected=true;
    }
    if (DSTseen) {
      dst_check.checked=DST;
    } else {
      dst_check.checked=false;
      var dst=checkdst(observer);
      if (dst != 0) {
        dst_check.checked=true;
      }
    }
    // Now we know where we want to observe set local time to be
    // equivalent to the PC time which may be in a different zone
    if (dst_check.checked) observer.tz-=60.0;
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
    sel_time_opt[0].selected=true;
    local_diff_opt[0].selected=true;
  }
  rewrite1();
}

// convertaa converts alt/az to ra/dec in table1 written by Nick Reid

function convertaa() {
   var alt=parsecol(document.table1.alt.value);
   var az=parsecol(document.table1.az.value);
   var radec=aatorad(alt,az,observer);
   document.table1.ra.value=hmdstring(radec[0]);
   document.table1.dec.value=anglestring(radec[1],false);
}

