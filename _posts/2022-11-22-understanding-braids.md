---
layout: post
title: Understanding Braids
category: blog
tags:
- braids
- digital synthesis
- eurorack
- tresses
---

A few weeks ago I started [my own
re-write](https://github.com/wee-noise-maker/tresses) of a digital audio
synthesis library. I took on this project not to reinvent the wheel, but to
understand how this wheel works. Here I want to share some of the things I
learned in the process.

I think this is also a fairly good introduction to digital synthesis if, like
me, you prefer the hands-on approach to the purely theoretical one.

# What is Braids?

{:refdef: style="text-align: center;"}
![](/assets/braids1.jpg){: width="35%" }
{: refdef}

Braids is a `digital` `synthesizer` `Eurorack module` from [Mutable
Instrument](https://mutable-instruments.net/modules/braids/).
 - `Synthesizer`: Shortcut for audio signal synthesizer, a device that produces
   sound signals. The signals are usually electrical and require a
   speaker/headphone to be listened to.
 - `Digital`: The audio signal is produced by a computer using numbers and
   calculation, and then converted to an electrical signal.
 - `Eurorack module`: Eurorack is a standard for modular synthesizers.
   Musicians combine signals from different modules to shape sound.

There are a couple of features that make Braids special:

 - It's a digital synthesizer, so the sound is produced with software as
   opposed to electronic components for an analog synthesizer. Code is far
   easier to look at and tweak than an electronic circuit, at least that's my
   point of view as a software engineer...
 - It's open-source (MIT license). Braids, and all the Mutable Instrument
   modules, are an exception in the audio/synthesizer industry where
   open-source software is not very common. This means other projects can use
   Braids code, e.g. Dirtywave's M8. It also means we can look at the code and
   understand how it works.
 - It's a `macro oscillator`. That means a single Braids module can produce a
   variety of relatively complex sounds. As opposed to most modules that will
   provide one signal and have to be combined with other modules for more
   complexity.

# Listening to Braids

The Braids module is not distributed by Mutable Instruments anymore, but there
are couple of options if you want to hear what it sounds like:
 - VCV Rack: There is a version of Braids available in the Eurorack simulator
   called [VCV Rack](https://vcvrack.com/). This is the easier/cheapest/fastest
   way to try Braids.
 - YouTube: There are plenty of videos showing Braids and its different sounds
 - Used market: You can get second hand modules on websites likes Reverb.com

# Basics of digital audio synthesis

The core principle of any digital sound synthesizer is to generate a series of
numbers, which will then be converted to variation of electric current, which
in turn will move a speaker cone to produce sound.

The generated numbers are called sample points, they represent signal value
from minimum amplitude to maximum amplitude. If you open an audio file with
Audacity and zoom in on the waveform, you can see the individual sample points:

{:refdef: style="text-align: center;"}
![](/assets/audacity_sample_points.png)
{: refdef}

There are two important properties for sample points, their bit depth and
frequency.

Bit depth is the number of bits used to encode the value. Frequency, usually
called sample rate, is the number of samples produced per second. Higher sample
rate will produce higher fidelity sound (up to a certain point) but also
requires more computing power.

For example CDs are at 16 bit depths 44.1k sample rate, Braids uses 16 bit
depth 96k sample rate.

# Generating waveforms with lookup tables

Audio synthesis generally starts by producing an oscillating signal at a given
frequency, that frequency being the pitch of the note to play. In Braids, this
is done by the [AnalogOscillator
class]([analog_oscillator.h](https://github.com/pichenettes/eurorack/blob/master/braids/analog_oscillator.h#L59)).
Don't be fooled by the name, Braids is simulating analog synthesis but we are
of course in digital territory here. Let's take, for example, a sinusoidal
signal.

Making a sinusoidale signal is very easy using the `sin()` function. Simple to
do, but quite expensive in terms of processor usage. Even more so when the
waveform becomes more complex than a sinusoidal. So a very common way to
generate signals at a lower CPU cost is to use lookup tables.

A lookup table is a precomputed series of results for a periodic function of
arbitrary complexity. This series is computed once during development of the
software, and stored in an array in the firmware.

<div style="width:100%; text-align:center;">
<canvas id="lookup_table" width="500" height="200"></canvas>
</div>
Using a lookup table, getting the result of a function just means reading a
value in the corresponding array.

Braids lookup tables are located in
[ressources.cc](https://github.com/pichenettes/eurorack/blob/master/braids/resources.cc)
and generated by [python
scripts](https://github.com/pichenettes/eurorack/tree/master/braids/resources).

## Phase

Looking at Braids' `AnalogOscillator` code you will see the `phase_` class
member. You can think of phase (a.k.a. "phase accumulator") as the current
position of the output signal in the waveform, and therefore as an index in the
waveform lookup table.

Since the signal is periodic, phase is a modulo counter. Once the phase reaches
the end of the lookup table it starts back from the beginning.

<div style="width:100%; text-align:center;">
  <canvas id="lookup_table_phase" width="500" height="200"></canvas>
  <form class="lookup_table_phase-controls" id="lookup_table_phase-form">
    <div class="input-group">
      <input type="range" id="phase" name="phase" min="0.0" max="2" value="0.2" step="0.001"/>
      <label for="phase">Phase</label>
    </div>
  </form>
</div>

## Phase increment

The phase increment value is telling by how much the phase has to move forward
between each output sample point.

The higher the phase increment, the faster the phase will step through the
lookup table, the higher the output frequency.

<div style="width:100%; text-align:center;">
  <canvas id="lookup_table_phase_incr" width="500" height="200"></canvas>
  <canvas id="lookup_output" width="500" height="200"></canvas>
  <form class="canvas-controls" id="lookup-phase-increment-form">
    <div class="input-group">
      <input type="range" id="phase-increment" name="phase_increment" min="0.1" max="10" value="2" step="0.01" />
      <label for="phase-increment">Phase Increment</label>
    </div>
  </form>
</div>

In Braids, there is a function that provides the phase increment for a given
note/pitch you can find it
[here](https://github.com/pichenettes/eurorack/blob/master/braids/analog_oscillator.cc#L46).
You will notice that the pitch to phase increment conversion itself uses a
lookup table...

## Interpolation and phase again

Above I said that phase can be seen as an index in the lookup table. It's
actually a little bit more complicated than that.

The waveform lookup tables are discrete representations of continuous signals.
In Braids they contain 257 elements. As you can see in the graph above, using a
discrete set of values to represent a continuous signal can lead to some
distortion. Try to set the phase increment to a low value for instance, the
output signal is all squared.

To generate a smooth output signal, we have to find the values of sample points
in-between the 257 values of the lookup table. This is called interpolation.
Given two points of a signal, find the value of another point in between.
Braids uses simple linear Interpolation for that, it's like drawing a straight
line between two points of the lookup table.

<div style="width:100%; text-align:center;">
  <canvas id="lookup_output_interp" width="500" height="200"></canvas>
  <form class="canvas-controls" id="lookup-output-interp-form">
    <div class="input-group">
      <input type="range" id="phase-increment" name="phase_increment" min="0.1" max="10" value="2" step="0.01" />
      <label for="phase-increment">Phase Increment</label>
    </div>
  </form>
</div>

For a given phase value, take lookup table values immediately above and below,
let's call them `A` and `B`. The linear interpolation is `A` plus the
difference between `B` and `A` multiplied by how far the phase is from `A`'s
index.

```c
inline int16_t Interpolate824(const int16_t* table, uint32_t phase) {
  int32_t a = table[phase >> 24];
  int32_t b = table[(phase >> 24) + 1];
  return a + ((b - a) * static_cast<int32_t>((phase >> 8) & 0xffff) >> 16);
}
```

That means the phase value is actually more than an index in the lookup table.
You can think of it as two components: the upper part of phase gives the first
index for the interpolation, and the lower part gives the distance from that
index.

# Macro oscillator

Braids is said to be a macro oscillator, that means it can generate multiple
different complex voices, and it does so by combining different synthesis
elements. We are going to look at one of those voices, I will let you dive into
the code to see how the others are built.

There are three main controls on the Braids module:
 - Model selection
 - Timber
 - Color

Model selection is pretty easy to understand, it's an encoder to select one of
the 49 different voices. Timber and Color have different effects depending on
the selected voice.

Let's say we select the second model: Morph (`/\-_` on the screen). This model
combines two different waveforms and then runs the result through a filter. The
Timber control sweeps through the different waveforms (Triangle + Saw, Square +
Saw, Square + Pulse). The Color control, on the other hand, modifies the
filter.

Let's see what it looks like in the code.

## Rendering

As I said at the beginning, the purpose of a digital synthesizer is to generate
a series of numbers. For Braids this process starts in the `Render` method of
the `MacroOscillator` class:

```c
void MacroOscillator::Render(
    const uint8_t* sync,
    int16_t* buffer,
    size_t size) {
  RenderFn fn = fn_table_[shape_];
  (this->*fn)(sync, buffer, size);
}
```

As you can see this method is very small. It takes a buffer and its size, gets
a function pointer from an array (`fn_table_`) using the `shape_` value, and
then calls that function. Note that I will ignore the `sync` buffer, it has to
do with the synchronization of waveforms and it's not critical to the
understanding of Braids.

The `shape_` value is set when turning the model selection encoder, for our
example:
[MACRO_OSC_SHAPE_MORPH]([settings.h:41](https://github.com/pichenettes/eurorack/blob/master/braids/settings.h#L38)).
[`fn_table_`]([macro_oscillator.cc:381](https://github.com/pichenettes/eurorack/blob/master/braids/macro_oscillator.cc#L381))
contains a function pointer for each of Braids synthesis models.

So in our case, `MacroOscillator::Render` calls the
`MacroOscillator::RenderMorph` method.

## MacroOscillator::RenderMorph

When looking at this method I will ignore some of the code for the sake of
clarity, in particular the part that deals with filtering.

The morph model uses two AnalogOscillator objects and combines their outputs.
The first lines of code set the pitch of the oscillators:
```c
  analog_oscillator_[0].set_pitch(pitch_);
  analog_oscillator_[1].set_pitch(pitch_);
```

As you can see they both have the same pitch here, for other models the
oscillators may have different pitch for detune effect.

Then the oscillators are configured based on the Timber control mentioned
earlier. The values of Timber and Color controls are stored in `parameter_[0]`
and `parameter_[1]` respectively in the code. They are members of the
`MacroOscilaltor` class. This piece of code does the morphing between two
waveforms:

```c
  uint16_t balance;
  if (parameter_[0] <= 10922) {
    analog_oscillator_[0].set_parameter(0);
    analog_oscillator_[1].set_parameter(0);
    analog_oscillator_[0].set_shape(OSC_SHAPE_TRIANGLE);
    analog_oscillator_[1].set_shape(OSC_SHAPE_SAW);
    balance = parameter_[0] * 6;
  } else if (parameter_[0] <= 21845) {
    analog_oscillator_[0].set_parameter(0);
    analog_oscillator_[1].set_parameter(0);
    analog_oscillator_[0].set_shape(OSC_SHAPE_SQUARE);
    analog_oscillator_[1].set_shape(OSC_SHAPE_SAW);
    balance = 65535 - (parameter_[0] - 10923) * 6;
  } else {
    analog_oscillator_[0].set_parameter((parameter_[0] - 21846) * 3);
    analog_oscillator_[1].set_parameter(0);
    analog_oscillator_[0].set_shape(OSC_SHAPE_SQUARE);
    analog_oscillator_[1].set_shape(OSC_SHAPE_SINE);
    balance = 0;
  }
```

We first see that there are three different cases depending on the value of
Timber (`parameter_[0]``):
 - 0 to 10922
 - 10923 to 21845
 - 21846 to 32767

For each case, the shape of the two waveforms is set, as well as the `balance`
value. Later in the code `balance` will control the mixing of the two
waveforms, i.e. which one we hear more than the other.

The third case is a bit different, balance is set to 0 which means only the
square wave can be heard, but on the other hand it's the parameter of
`analog_oscillator_[0]` that varies. This parameter controls the pulse width of
the square signal.

The interactive graph below will give you an idea of what the morphing will
look like on the output:

<div style="width:100%; text-align:center;">
  <canvas id="morph" width="500" height="200"></canvas>
  <form class="morph-controls" id="morph-form">
    <div class="input-group">
      <input type="range" id="timber" name="timber" min="0" max="10" value="0.1" step="0.01" />
      <label for="timber">Timber</label>
    </div>
  </form>
</div>

The next step is rendering:
```c
  int16_t* shape_1 = buffer;
  int16_t* shape_2 = temp_buffer_;
  analog_oscillator_[0].Render(sync, shape_1, NULL, size);
  analog_oscillator_[1].Render(sync, shape_2, NULL, size);
```

Calling the `Render` method of each `AnalogOscillator` with a different buffer.
`Render` will use the lookup table synthesis explained above to generate audio
signal.

And finally, mixing the two different signals (with the filtering stuff
removed):
```c
  while (size--) {
    *buffer++ = Mix(*shape_1++, *shape_2++, balance);
  }
```
Set each sample point output with a mix of the two `AnalogOscillator`s output.

# Conclusion

And that's it! With what we have seen in this post you have all the key
elements to understand the `AnalogOscillator` part of Braids's models. The
other models are just a different combination of settings and mixing for the
`AnalogOscillators`.

If you enjoyed this blog post, let me know and I might do a second part on the
`DigitalOscillator` part of Braids that includes drums sounds, and plucked or
fluted instrument simulation.

# Bonus section: `A * B >> 15`

This code pattern is very common throughout Braids, two values multiplied and
then shifted to the right by 15. This operation is in fact a fixed-point
multiplication.

Without explicitly saying it, Braids is heavily relying on fixed-point
representation and operations. In particular the 16 bit fixed-point format
[Q0.15](https://en.wikipedia.org/wiki/Q_(number_format)) (sometimes abbreviated
Q15). This format represents values from `-1` to `1 - 2^-15
(0.999969482421875)` using 16 bit 2's complement signed values (`int16_t`) that
the CPU knows how to manipulate.

To go from the `int16_t` value to the fixed point value we just have to divide
by `2^15`:
 * `-32768 / 2^15 = -1.0`
 * `-5367 / 2^15 = -0.163787841796875`
 * `20000 / 2^15 = 0.6103515625`
 * `32767 / 2^15 = 0.999969482421875`

In practice we never do this conversion in the code because there's no need,
but this is to give you an idea of how fixed-point works.

Why Q15? Because this is what the 16 bit audio format is in essence, a
succession of 16 bit values representing the signal strength from -1 to 1.

## Going back to `A * B >> 15`

So when multiplying two Q15 numbers we are just multiplying two factors from
-1.0 to 1.0. Conceptually we expect a result from -1.0 to 1.0, but since under
the hood we are multiplying two 16 bit signed integers we can very quickly run
into problems:

```c
int16_t a = 16384; // 0.5
int16_t b = 22937; // ~0.7
int16_t result = a * b; // Integer overflow! (undefined behavior)
```

This is why, even though I said Braids uses the 16bit Q15 format, you will see
that many operations are done in 32 bit:

```c
int32_t a = 16384; // 0.5
int32_t b = 22937; // ~0.7
int32_t result = a * b; // 375799808
```

We avoided the integer overflow, but our result still doesn't fit in 16 bit and
therefore is not a valid Q15 number.

To find our number in Q15 format, the result has to be divided by 2 to the
power of 15 (see [here for more
explanations](https://en.wikipedia.org/wiki/Fixed-point_arithmetic)):

```c
int32_t a = 16384; // 0.5
int32_t b = 22937; // ~0.7
int32_t result = a * b >> 15; // 11468 = ~0.35
```

With this pattern in mind, Braids' code will be easier to understand.

# Acknowledgment

The interactive graphs in this post are based on the excellent: [The Design of
the Roland Juno
oscillators](https://blog.thea.codes/the-design-of-the-juno-dco/) by [Thea
(Stargirl) Flowers](https://thea.codes/).


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

                // this.mask_out(this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2, 30);
                // ctx.fillStyle = "#888888";
                // ctx.font = alt_font;
                // ctx.fillText("+", this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2 - 60);
                // ctx.fillText("0", this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2);
                // ctx.fillText("-", this.top_right_x - padding_x / 2, this.top_right_y + this.height / 2 + 60);
                // ctx.font = primary_font;
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

        plot_single(func, t= 0.1, line = false, color = "#408C94") {
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

                let out = func(t);
                this.ctx.strokeStyle = color;
                this.ctx.fillStyle = color;
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

    (function lookup_table() {
        const grapher = new Grapher("lookup_table");
        grapher.centered = true;

        function draw(params) {
            grapher.clear();
            grapher.plot_discrete((t) => lookup_table_func(+params.phase_increment,t), 0.05, false, "yellow");
            grapher.draw_frame("Index", "Lookup table");
        }

        form_driven_canvas("lookup-phase-increment-form", draw);
    })();

    (function lookup_table_phase() {
        const grapher = new Grapher("lookup_table_phase");
        grapher.centered = true;

        function draw(params) {
            grapher.clear();
            grapher.plot_discrete((t) => lookup_table_func(0,t), 0.05, false, "yellow");
            grapher.plot_single((t) => phase_func(0, t), +params.phase % 1, true, "green");
            grapher.draw_frame("Index", "Lookup table");
        }

        form_driven_canvas("lookup_table_phase-form", draw);
    })();

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
        const grapher = new Grapher("lookup_table_phase_incr");
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
            grapher.draw_frame();
        }

        form_driven_canvas("lookup-phase-increment-form", draw);
    })();

    (function lookup_output_interp() {
        const grapher = new Grapher("lookup_output_interp");
        grapher.centered = true;

        function draw(params) {
            grapher.clear();
            grapher.plot_discrete((t) => output_func(+params.phase_increment, t), 0.01, true, discrete_color_gradiant);
            grapher.plot_function((t) => output_interp_func(+params.phase_increment, t), "green");
            grapher.draw_frame();
        }

        form_driven_canvas("lookup-output-interp-form", draw);
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
