function Gray64(xres, yres)
{
  var xres = Math.floor(xres),
      yres = Math.floor(yres),
      rowlength = xres,
      yoffset = Math.floor(yres / 2);
  this.m = new Array(xres * yres);

  this.downsample = function(buf)
  {
    for (var x = 0; x < xres; x++)
    {
      for (var y = 0; y < yres; y++)
      {
        var xy = y * rowlength + x;
        buf[xy*4] = buf[xy*4 + 1] = buf[xy*4 + 2]
            = 3 * this.m[xy] / this.max_value;
      }
    }
  };

  this.expose = function(x, y, value)
  {
    if (isNaN(value))
        return;
    var xy = (y + yoffset)*rowlength + x;
    this.max_value += 1 / (xres * yres);
//if (this.m[xy] != 0) console.log("A");//buf[xy*4]);
    return this.m[xy] += value;
  };

  this.clear = function()
  {
    for (var i = 0; i < xres*yres; i++)
    {
      this.m[i] = 0;
    }
    this.max_value = 0.000001;
  }

  this.clear();
};
