---
layout: my_home
---

Work in progress...

<canvas id="lookup_table" width="750" height="200"></canvas>
<canvas id="lookup_output" width="750" height="200"></canvas>
<form class="canvas-controls" id="lookup-phase-increment-form">
  <div class="input-group">
    <input type="range" id="phase-increment" name="phase_increment" min="0.1" max="10" value="2" step="0.01" />
    <label for="phase-increment">Phase Increment</label>
  </div>
</form>

<canvas id="morph" width="750" height="300"></canvas>
<form class="morph-controls" id="morph-form">
  <div class="input-group">
    <input type="range" id="timber" name="timber" min="0.1" max="10" value="2" step="0.01" />
    <label for="timber">Timber</label>
  </div>
</form>

<script>

// Based on https://github.com/theacodes/blog.thea.codes/blob/main/srcs/the-design-of-the-juno-dco/animations.js

function start_animations() {
    "use strict";
    const padding_x = 30;
    const padding_y = 30;
    const font_name = "'zeroesone'"
    const primary_font = `italic 20px ${font_name}`;
    const alt_font = `20px ${font_name}`;
    const info_font = `italic 25px ${font_name}`;
    const graph_line_width = 2;
    const graph_point_width = 3;

    class Grapher {
        constructor(canvas_elem_id) {
            this.canvas = document.getElementById(canvas_elem_id);
            this.ctx = this.canvas.getContext("2d");
            this.canvas_width = this.canvas.width;
            this.canvas_height = this.canvas.height;
            this.bottom_left_x = padding_x;
            this.bottom_left_y = this.canvas.height - padding_y;
            this.bottom_right_x = this.canvas.width - padding_x;
            this.bottom_right_y = this.canvas.height - padding_y;
            this.top_left_x = padding_x;
            this.top_left_y = padding_y;
            this.top_right_x = this.canvas.width - padding_x;
            this.top_right_y = padding_y;
            this.width = this.bottom_right_x - this.bottom_left_x;
            this.height = this.bottom_left_y - this.top_left_y;
            this.graph_offset = 10;

            this.ctx.strokeStyle = "teal";
            this.ctx.lineWidth = graph_line_width;
            this.ctx.lineJoin = "round";

            this.centered = false;
        }

        clear() {
            this.ctx.clearRect(0, 0, this.canvas_width, this.canvas_height);
        }

        draw_frame(x_label = "time", y_label="output") {
            const ctx = this.ctx;

            ctx.save();
            ctx.strokeStyle = "#333333";
            ctx.fillStyle = "#333333";
            ctx.lineWidth = 2;
            ctx.font = primary_font;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.beginPath();
            ctx.moveTo(this.bottom_left_x, this.bottom_left_y)
            ctx.lineTo(this.bottom_right_x, this.bottom_right_y);
            ctx.closePath();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(this.bottom_right_x - 20, this.bottom_right_y);
            ctx.lineTo(this.bottom_right_x - 30, this.bottom_right_y - 10);
            ctx.lineTo(this.bottom_right_x, this.bottom_right_y);
            ctx.lineTo(this.bottom_right_x - 30, this.bottom_right_y + 10);
            ctx.lineTo(this.bottom_right_x - 20, this.bottom_right_y);
            ctx.closePath();
            ctx.fill();

            this.clear_text_area(this.bottom_left_x + this.width / 2, this.bottom_left_y, x_label);
            ctx.fillText(x_label, this.bottom_left_x + this.width / 2, this.bottom_left_y);

            ctx.beginPath();
            ctx.moveTo(this.bottom_left_x, this.bottom_left_y)
            ctx.lineTo(this.top_left_x, this.top_left_y);
            ctx.closePath();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(this.top_left_x, this.top_left_y + 20);
            ctx.lineTo(this.top_left_x - 10, this.top_left_y + 30);
            ctx.lineTo(this.top_left_x, this.top_left_y);
            ctx.lineTo(this.top_left_x + 10, this.top_left_y + 30);
            ctx.lineTo(this.top_left_x, this.top_left_y + 20);
            ctx.closePath();
            ctx.fill();


            if(this.centered) {
                ctx.strokeStyle = "#AAAAAA";
                ctx.beginPath();
                ctx.setLineDash([5, 20]);
                ctx.moveTo(this.top_left_x, this.top_left_y + this.height / 2);
                ctx.lineTo(this.bottom_right_x, this.top_left_y + this.height / 2);
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);

                this.mask_out(this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2, 30);
                ctx.fillStyle = "#888888";
                ctx.font = alt_font;
                ctx.fillText("+", this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2 - 60);
                ctx.fillText("0", this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2);
                ctx.fillText("-", this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2 + 60);
                ctx.font = primary_font;
            }

            ctx.fillStyle = "#333333";
            ctx.translate(this.top_left_x - 2, this.top_left_y + this.height / 2 + 5);
            ctx.rotate(-Math.PI / 2);
            this.clear_text_area(0, 0, y_label, 20, 0.8, 100, 1.5, 1);
            ctx.fillText(y_label, 0, 0);
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            ctx.restore();
        }

        mask_out(x, y, size=50, extent=80) {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            let gradient = ctx.createRadialGradient(
                x, y, size,
                x, y, extent
            );
            gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, extent, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();

            ctx.globalCompositeOperation = "source-over";
            ctx.restore();
        }

        plot_function(func, color = "#408C94") {
            const max_width = this.width - this.graph_offset * 0.96;
            const max_height = this.height - this.graph_offset * 0.96;
            const left = this.bottom_left_x + (this.centered ? this.graph_offset : 0);
            const top = this.top_left_y;
            const bottom = this.bottom_left_y;
            let origin = 0;
            let mult = 1.0;

            if(this.centered) {
                origin = this.height / 2;
                mult = 0.5;
            }

            this.ctx.strokeStyle = color;
            this.ctx.beginPath();
            for(let t = 0; t <= 1.0; t += 1 / this.width) {
                let out = func(t);
                let x = left + Math.min(t * max_width, max_width);
                let y = bottom - origin - (out * mult * max_height);
                if(y > bottom) y = bottom;
                if(y < top) y = top;
                t == 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
            }
            this.ctx.stroke();
        }

        plot_discrete(func, interval = 0.1, line = false, color = "#408C94") {
            const max_width = this.width - this.graph_offset * 0.96;
            const max_height = this.height - this.graph_offset * 0.96;
            const left = this.bottom_left_x + (this.centered ? this.graph_offset : 0);
            const top = this.top_left_y;
            const bottom = this.bottom_left_y;
            let origin = 0;
            let mult = 1.0;

            if(this.centered) {
                origin = this.height / 2;
                mult = 0.5;
            }

            var cnt = 0;
            for(let t = 0; t <= 1.0; t += interval) {
                let out = func(t);
                if (out != null) {
                    if (Array.isArray(color)) {
                        this.ctx.strokeStyle = color[cnt % color.length];
                        this.ctx.fillStyle = color[cnt % color.length];
                        cnt += 1;
                    } else {
                        this.ctx.strokeStyle = color;
                        this.ctx.fillStyle = color;
                    }
                    let x = left + Math.min(t * max_width, max_width);
                    let y = bottom - origin - (out * mult * max_height);
                    if(y <= bottom && y >= top) {
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, graph_point_width, 0, 2 * Math.PI, true);
                        this.ctx.fill();
                        if (line) {
                           this.ctx.beginPath();
                           this.ctx.moveTo(x, bottom - origin);
                           this.ctx.lineTo(x, y);
                           this.ctx.stroke();
                        }
                   }
                }
            }
        }

        clear_text_area(x, y, text, line_width=20, alpha=0.8, blur=100, x_mult = 2, y_mult = 1) {
            let extents = this.ctx.measureText(text);
            this.ctx.save();
            this.ctx.globalCompositeOperation = "destination-out";
            this.ctx.lineWidth = line_width;
            this.ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            this.ctx.fillStyle = "black";
            this.ctx.shadowColor = "black";
            this.ctx.shadowBlur = blur;
            this.ctx.beginPath();
            this.ctx.rect(
                x - extents.actualBoundingBoxLeft * x_mult,
                y - extents.actualBoundingBoxAscent * y_mult,
                (Math.abs(extents.actualBoundingBoxLeft) + Math.abs(extents.actualBoundingBoxRight)) * x_mult,
                (extents.actualBoundingBoxAscent + extents.actualBoundingBoxDescent) * y_mult);

            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.globalCompositeOperation = "source-over";
            this.ctx.restore();
        }

        draw_info(text) {
            this.ctx.font = info_font;
            this.ctx.textBaseline = "top";
            this.ctx.textAlign = "left"
            this.clear_text_area(this.top_left_x + padding_x, this.top_left_y, text, 20, 0.8, 100, 1, 1);
            this.ctx.fillStyle = "black";
            this.ctx.fillText(text, this.top_left_x + padding_x, this.top_left_y);
        }
    }

    function params_from_form(form_elem) {
        let output = {};
        (new FormData(form_elem)).forEach(function(value, key){
            output[key] = value;
        });
        return output;
    }


    function form_driven_canvas(form_elem_id, draw_func) {
        const form_elem = document.getElementById(form_elem_id);
        form_elem.addEventListener("input", (e) => draw_func(params_from_form(form_elem)));
        draw_func(params_from_form(form_elem));
    }

    function calculator_form(form_elem_id, calc_func) {
        const form = document.getElementById(form_elem_id);

        function update() {
            form.output.value = calc_func(form);
        }

        form.addEventListener("input", (e) => update());
        update();
    }


    function waveform(t) {
        // return (Math.sin ((2 * Math.PI) * t) + Math.sin ((4 * Math.PI) * t)) / 2;
        return Math.sin ((2 * Math.PI) * t);
    }

    function floor_to_lkp_index(t) {
        return Number((Math.floor(t*20)/20).toFixed(2));
    }

    function lookup_table_func(phase_increment, t) {
        return waveform (t);
    }

    function phase_func(phase_increment, t) {
        return waveform(floor_to_lkp_index(t));
    }

    function output_func(phase_increment, t) {
        t = phase_increment * t;
        return waveform(floor_to_lkp_index(t));
    }

    function output_interp_func(phase_increment, t) {
        var ta = phase_increment * t;
        var t1 = floor_to_lkp_index(ta);
        var t2 = t1 + 0.05
        var v1 = waveform(t1);
        var v2 = waveform(t2);

        var dt = ta - t1;
        return v1 + ((v2 - v1) * (dt / 0.05));
    }

    const discrete_color_gradiant = [
      '#ff0000', 
      '#f2000a', 
      '#e60014', 
      '#d9001f', 
      '#cc0029', 
      '#bf0033', 
      '#b2003d', 
      '#a60047', 
      '#990052', 
      '#8c005c', 
      '#800066', 
      '#730070', 
      '#66007a', 
      '#590085', 
      '#4d008f', 
      '#400099', 
      '#3300a3', 
      '#2600ad', 
      '#1900b8', 
      '#0d00c2', 
      '#0000cc', 
      '#0d00c2', 
      '#1a00b8', 
      '#2600ad', 
      '#3300a3', 
      '#400099', 
      '#4c008f', 
      '#590085', 
      '#66007a', 
      '#730070', 
      '#800066', 
      '#8c005c', 
      '#990052', 
      '#a60047', 
      '#b2003d', 
      '#bf0033', 
      '#cc0029', 
      '#d9001f', 
      '#e60014', 
      '#f2000a',
      '#ff0000'
      ];
    (function lookup_table() {
        const grapher = new Grapher("lookup_table");
        grapher.centered = true;

        function draw(params) {
            grapher.clear();
            grapher.plot_discrete((t) => phase_func(+params.phase_increment,t), +params.phase_increment / 100, true, discrete_color_gradiant);
            grapher.plot_discrete((t) => lookup_table_func(+params.phase_increment,t), 0.05, false, "yellow");
            grapher.draw_frame("Index", "Lookup table");
        }

        form_driven_canvas("lookup-phase-increment-form", draw);
    })();

    (function lookup_output() {
        const grapher = new Grapher("lookup_output");
        grapher.centered = true;

        function draw(params) {
            grapher.clear();
            grapher.plot_discrete((t) => output_func(+params.phase_increment, t), 0.01, true, discrete_color_gradiant);
            grapher.plot_function((t) => output_interp_func(+params.phase_increment, t), "green");
            grapher.draw_frame();
        }

        form_driven_canvas("lookup-phase-increment-form", draw);
    })();

    function morph_func(frequency, timber, color, t) {
        const saw = (((frequency * t) % 1.0) * 2) - 1;

        const saw2 = (((frequency * t + 0.25) % 1.0) * 2) - 1;
        const triangle = saw2 < 0 ? saw2 * 2 + 1 : 2 - (saw2 * 2 + 1);
        const square = ((frequency * t % 1.0 < 0.5) * 2) - 1;
        const sine = Math.sin(t * frequency * Math.PI * 2);

        var f1;
        var f2;
        var balance;
        
        if (timber <= 3.3) {
           f1 = saw;
           f2 = triangle;
           balance = (timber * 3) / 10;
        } else if (timber <= 6.6) {
           f1 = square;
           f2 = saw;
           balance = ((timber - 3.3) * 3) / 10;
        } else {
           const pw = ((timber - 6.6) * 3) / 20;

           f1 = sine;
           f2 = ((frequency * t % 1.0 < (0.5 + pw)) * 2) - 1;
           balance = 0;
        }

        return f1 * balance + f2 * (1 - balance);
    }

    (function morph() {
        const grapher = new Grapher("morph");
        grapher.centered = true;

        function draw(params) {
            grapher.clear();
            grapher.plot_function((t) => morph_func(4, +params.timber, +params.color, t), "green");
            grapher.draw_frame();
        }

        form_driven_canvas("morph-form", draw);
    })();
}

start_animations()
</script>
