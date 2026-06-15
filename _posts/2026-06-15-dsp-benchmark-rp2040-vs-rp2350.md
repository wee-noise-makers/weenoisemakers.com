---
layout: post
title: 'DSP Benchmark: RP2040 vs RP2350'
category: blog
excerpt_separator: <!--more-->
tags:
- noise-nugget
---

As announced last week, our Noise Nugget project received a grant from the
NLnet foundation. One of the main goals of this grant is to design a new
generation of hardware with a better microcontroller. The obvious choice for
this new generation is the RP2350, the successor of the RP2040. In this post, I
want to measure the gains we can expect with a new Noise Nugget based on the
RP2350.

<!--more-->

# History of the project

The first version of Noise Nugget was my entry to the 2018 Hackaday Prize
([made it to the
semifinals](https://hackaday.io/list/161904-thp-2018-semifinalists-musical-instrument)).
It was the beginning of my adventures in hardware audio synthesis, and the goal
was to make the smallest digital synth possible. The tag line was "Square Inch
music widget" at the time. A microcontroller, an audio DAC, a USB connector,
and a headphone output. That's it.

{:refdef: style="text-align: center;"}
![Picture of the original Noise
 Nugget](/assets/dsp-benchmark/original_noise_nugget.JPG){: width="30%" }
{: refdef}

Over the years, the concept has evolved into an all-in-one platform for making
audio devices, from prototype to batch production. Bundling most of the
complexity of audio devices into a single package with a focus on cost and
design for manufacture (DFM).

The last version was created as part of the design of our [PGB-1 pocket groove
box](https://weenoisemakers.com/pgb-1/), and was key to the success of our
production. It demonstrated the value of this project and validated the
concept. With the help of the [NLnet grant] (link to blog post), we want to
continue improving and make Noise Nugget the go-to open-hardware and
open-source solution for creating musical gadgets.

# Hardware evolutions

The concept went through at least 5 major evolutions and 3 different
microcontrollers. The last version, called Noise Nugget 2040, features an
RP2040 microcontroller, 16 Mbytes of flash memory, and an audio interface with
3 stereo inputs, a stereo line output, a stereo headphone output, and a stereo
speaker output. It uses M.2. style edge connector format, which makes it easy
to integrate into small to large productions.

{:refdef: style="text-align: center;"}
![Picture of the Noise
Nugget 2040](/assets/noise-nugget-2040/nn-2040-product-image.png){:width="40%"}
{:refdef}

The choice of the RP2040 was made during the post-COVID chip shortage, as it
was the only one available at the time. But it was still the best option
regardless of supply: a relatively large amount of RAM for its category, unique
hardware features that offer a lot of flexibility (PIOs), excellent software
support and documentation, and a low cost (\~0.6 euros).

Entering this new step in the Noise Nugget project, I want to upgrade the
hardware once again. This time, the overall design will remain the same and be
retro-compatible.

The obvious choice of microcontroller for this new generation is the RP2350,
the successor of the RP2040. It builds upon and improves what made the RP2040 a
good choice back then. In particular, with its dual-core Cortex-M33, which,
although clocked at a lower speed, will deliver a computing performance boost
and hardware floating-point support, a major drawback of the RP2350. But also:

- Double internal RAM (520kB) 
- Option for external RAM up to 8MB (\~95 seconds of audio at 44.1kHz)
- More PIO state machines (12 vs 8) 
- Double analog inputs (8 ADCs)
- HSI peripheral enabling DVI/HDMI video output (without overclocking)

But before rushing into a new design, I want to make sure the performance boost
is worth it and test a theory about the software libraries that will come next.
So, going into this benchmarking, there are two questions I want to answer

- Is it worth making a new design using the RP2350? (vs RP2040 currently)
- Are there any benefits to fixed-point DSP vs floating-point DSP on the RP2350?

# Benchmarking

To answer these questions, I worked on a benchmarking project to compare the
performance of the two microcontrollers across different scenarios.

Caveat emptor: most benchmarking activities are flawed in one way or another. I
know the results below are not a 100% accurate measure of the two
microcontrollers' performance. Performance will vary depending on the actual
application and its cache behavior, etc.

Most of the measures come from repeated runs of various mathematical operations
on buffers of increasing sizes (32 to 2048). Some benchmarks use the CMSIS DSP
library provided by Arm, others are "naive" counterparts that compare
compiler-optimized code with the CMSIS DSP, and finally, a more realistic
benchmark using Mutable Instruments' code for the Braids Eurorack module.

[The repo is here](https://github.com/wee-noise-makers/mcu-dsp-benchmark). Of
course, don't hesitate to contribute if you want to. In particular, I am
interested in seeing the benchmark results on other microcontrollers. At the
moment

# Results

## RP2040 vs RP2350

We start with the RP2040 vs RP2350 comparison, and what I call the "vector
math" operations, which means calling the CMSIS DSP library to perform
computations on entire buffers. For instance, given buffers of 128 values, add
the first value of a buffer to the first value of the second buffer and write
the result in a third buffer. The 128 operations are done in a single call to
the CMSIS DSP library.

In the graph below, at the bottom, you can see the different operations (add,
multiply, subtract) and the type of the operands (f32 for 32-bit
floating-point, q15 for 16-bit fixed-point, q31 for 32-bit fixed-point). On the
vertical axis, the maximum number of operations per second. In blue, we have
the results for the RP2040, in orange, the RP2350. The buffer size will
accentuate the differences. I've chosen to show the results with buffers of 128
elements here, because that seems like a good middle ground for audio, but you
can see the results for buffers between 32 and 2048 in [the
repo](https://github.com/wee-noise-makers/mcu-dsp-benchmark).

{:refdef: style="text-align: center;"}
![](/assets/dsp-benchmark/RP2040--200Mhz--vs-RP2350--ARM-150Mhz-vector-math-with-buffers-of-128.svg){:width="80%"}
{:refdef}


First, if we look at the floating-point operations (all the \_f32), we see that
the RP2040 (blue) performs very poorly. But that was expected, since the RP2040
doesn't have hardware floating-point support, so all f32 operations are
"simulated" in software. Next, the Q15 (16-bit fixed-point), here I am actually
impressed by the performance, \~3.5 times on additions, \~3 times on
subtractions, even with a slower CPU clock. Q15 multiplication is a bit less
impressive, with a \~1.7x boost. Q31 (32-bit fixed-point) is even better, with
about 4 times the performance on the RP2350 vs. the RP2040.

Next up, we have what I called "non-vector" maths, which are the same
operations as the results before, but implemented in naive loops instead of
calling the CMSIS DSP library. This will show us how the compiler (GCC here)
can optimize these operations. Note that the compiler will still use vectorized
instructions here, but will it be as fast?

{:refdef: style="text-align: center;"}
![](/assets/dsp-benchmark/RP2040--200Mhz--vs-RP2350--ARM-150Mhz-non-vector-math-with-buffers-of-128.svg){:width="80%"}
{:refdef}


We see the same huge gap for f32, again, that's expected. \~30% less
performance on the RP2350 compared to CMSIS DSP on the Q15 add and sub
operations. The biggest surprise here is that Q15 and Q31 operations give
better results than the CMSIS DSP version on RP2040.

For the last comparison between the RP2040 and the RP2350, I am using the code
from Mutable Instruments' Braids. I know the project pretty well, and it's
implemented using Q15 fixed-point, so it is a fair comparison for the RP2040.
It's also an interesting benchmark because it's full digital synthesis using
various algorithms.

In this benchmark, we compare several Braids macro oscillators and show the
results as the maximum theoretical number of voices we can run on a single CPU
core (both the RP2040 and RP2350 have two cores) at a 44.1kHz sample rate.

{:refdef: style="text-align: center;"}
![](/assets/dsp-benchmark/Braids-max-voices-per-core-at-44.1kHz.svg){:width="80%"}
{:refdef}


We see about 30-50% better performance on the RP2350. This is far from the
+200% seen in the CMSIS DSP benchmark, but Braids is not using this library is
was not optimized for vector operations.

## F32 vs Q15 on the RP2350

As we saw above, the biggest performance boost comes from CMSIS DSP operations
on Q15. Floating-point DSP is easier to implement, very fast, and more common
in modern architectures, but fixed-point is still relevant for low-cost,
low-energy microcontrollers. Along with the hardware, my goal with the Noise
Nugget is to provide a full-featured DSP library using Q15 type for maximum
performance. So the next question is, how will Q15 compare to F32 on the
RP2350?

So here are a few graphs comparing f32, Q15, and Q31 on the RP2350. FFT, RMS,
and interpolation are provided by the CMSIS DSP library.

{:refdef: style="text-align: center;"}
![](/assets/dsp-benchmark/vector-math-on-RP2350--ARM-150Mhz--with-buffers-of-128.svg){:width="80%"}
![](/assets/dsp-benchmark/interpolation-on-RP2350--ARM-150Mhz--with-buffers-of-128.svg){:width="80%"}
![](/assets/dsp-benchmark/RMS-on-RP2350--ARM-150Mhz--with-buffers-of-128.svg){:width="80%"}
![](/assets/dsp-benchmark/FFT-on-RP2350--ARM-150Mhz-.svg){:width="80%"}
{:refdef}


As you can see, there are no strong conclusions we can take from this. Q15 is
faster for some basic operations but slower for others. I am surprised by the
speed of f32-fast FFTs (orange), but I couldn't find information on how they
differ from regular f32 FFTs (blue). It could be that they have lower accuracy,
like the CMSIS DSP "fast math" function that provides "fast approximation to
sine, cosine, and square root". Does it mean we can make a "fast" version of
the Q15 FFT?

# Conclusion

So we had two questions to answer:

- Is it worth making a new design using the RP2350? (vs RP2040 currently)

I think this is a clear yes: 2 to 4 times the computing performance,
floating-point support, more RAM, etc.

- Are there any benefits to fixed-point DSP vs floating-point DSP on the RP2350?

This is less clear and will require further benchmarking during the development
of the fixed-point library.

The next step in this project is to begin the hardware design. I plan to do
schematic and design reviews, so follow us
on [Mastodon](https://mamot.fr/@DesChips), [Reddit](https://www.reddit.com/user/Fabien_C/), [YouTube](https://www.youtube.com/@WeeNoiseMakers),
or [Instagram](https://www.instagram.com/weenoisemakers/) to get regular
updates on the project.

# Bonus

If you are familiar with the ecosystem of micro-controllers and development
boards, you may wonder why I didn't choose the micro-controller used in the
Teensy 4.x boards (iMX RT1060). Well, this chip is known for its performance,
and I did run some of the benchmarks on it for comparison (see the braids
benchmark below, it's indeed very fast), but there are other factors to take
into account:

- The chip itself is 10 times more expensive 
- It's a lot bigger, and uses BGA (ball-grid-array) type of mounting. This means very high production costs that are not realistic for this project
- It requires a dedicated "bootloader" chip and firmware to be fully compatible with the Teensy ecosystem. It is possible to acquire the chip, but it costs more than the RP2350 alone...
- The RP2350 can do some things that the iMX RT1060 cannot (PIO, video output, etc.)

So all in all, the iMX RT1060 is indeed impressive, but it is not the right
choice for the Noise Nugget.

{:refdef: style="text-align: center;"}
![](/assets/dsp-benchmark/Braids-max-voices-on-all-cores-at-44.1kHz.svg){:width="80%"}
{:refdef}
