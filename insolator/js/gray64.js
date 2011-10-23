function Gray64(xres, yres)
{
  this.m = new Array(xres * yres);
  for (var i = 0; i < xres*yres; i++)
  {
    this.m[i] = 0;
  }
  this.rowlength = xres;
  this.yoffset = yres / 2;
  this.downsample = function()
  {
    return rgb24;
  };

  this.add_fraction = function(image/*, divisor = 0x10000*/)
  {
  };

  this.maximum = function(image)
  {
    return max_value;
  };

  this.expose = function(x, y, value)
  {
    var xy = (y + this.yoffset)*this.rowlength + x;
    return this.m[xy] += value;
  };
};
