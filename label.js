var fs = require('fs');
var path = require('path');
var extend = require('extend');

var Canvas = require('canvas');
var Image = Canvas.Image;
var Font = Canvas.Font;

var outPath = null;

if(!Font) {
  throw new Error("Hm. It seems like node-canvas was not compiled with canvas support. Missing dependencies maybe?");
}

module.exports = function(opts) {

    this.opts = {
        allowLineBreaks: false, // allow automatic line breaking
        padding: {
            top: 15,
            left: 15,
            right: 15,
            bottom: 15
        },
        font: {
            dir: path.join(__dirname, 'fonts'),
            size: 50,
            lineSpacing: 10,
            color: '#000000',
            normal: 'Inconsolata-Regular.ttf',
            bold: 'Inconsolata-Bold.ttf'
        },
        
        label: {
            // only change width and height if using different label paper
            width: 1083, // in pixels,
            height: 336 // in pixels
        }
    };

    this.opts = extend(true, this.opts, opts);

    this.fail = function(err) {
        throw new Error(err);
    };

    this.fontPath = function(filename) {
        return path.join(this.opts.font.dir, filename);
    };

    this.canvas = new Canvas(this.opts.label.width, this.opts.label.height);
    this.ctx = this.canvas.getContext('2d');

    // Set white background
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.fillRect(0, 0, this.opts.label.width, this.opts.label.height); 
    
    // Set font color
    this.ctx.fillStyle = this.opts.font.color || 'black';

    // Load fonts
    this.ctx.addFont(new Font('normalFont', this.fontPath(this.opts.font.normal)));
    this.ctx.addFont(new Font('boldFont', this.fontPath(this.opts.font.bold)));
    

    this.fontStyles = {
        normal: this.opts.font.size+'px normalFont',
        bold: this.opts.font.size+'px boldFont'
    }

    this.ctx.font = this.fontStyles.normal;

    this.letterWidth = this.ctx.measureText('o').width;
    this.letterHeight = this.ctx.measureText('o').emHeightAscent;
    this.maxLineWidth = this.opts.label.width - this.opts.padding.left - this.opts.padding.right;

    this.yOffset = this.opts.padding.top + this.opts.font.size; 
    this.lineCount = 0;

    this.writeLine = function(str, style) {
        if((this.yOffset + this.opts.padding.bottom) > this.opts.label.height) {
            this.fail("Too many lines. Text does not fit on label.");
        }
        if(!style) {
            style = 'normal';
        }
        this.ctx.font = this.fontStyles[style];

        this.ctx.fillText(str, this.opts.padding.left, this.yOffset);
        this.yOffset += this.letterHeight + this.opts.font.lineSpacing;
        this.lineCount++;
    };

    this.write = function(str, style) {
        if(!str) {
            str = '';
        }
        var w = this.ctx.measureText(str).width;
        if(w > this.maxLineWidth) {
            var extraLetters = Math.ceil((w - maxLineWidth) / this.letterWidth);

            if(!this.opts.allowLineBreaks) {
                this.fail("Line " + (this.lineCount + 1) + " is too long by " + extraLetters + " letters and line breaking is not allowed (hint: use -b to allow line breaks)");
            } else {
                var oneLineLength = str.length - extraLetters;
                this.writeLine(str.slice(0, this.oneLineLength), style);
                this.write(str.slice(this.oneLineLength), style);
            }
            
        } else {
            return this.writeLine(str, style);
        }
    };

    this.saveImage = function(outPath, callback) {

        var out = fs.createWriteStream(outPath);
        var stream = this.canvas.createPNGStream();
        
        stream.on('data', function(chunk){
            out.write(chunk);
        });
        
        stream.on('end', function() {
            if(callback) {
                callback();
            }
        });
        
    }    
    
};
