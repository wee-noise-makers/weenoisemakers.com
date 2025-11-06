---
layout: product-page
permalink: /amvs/
discord: 'https://discord.gg/FCraj7z3CX'
product-name: 'AMVS'
product-tagline: '3D Printable Modular Stand System for the Korg Volca.'
product-background: '/assets/amvs-1/wnm-amvs-1-product-image.png'
product-description: |

   3D printable modular system designed to support from one to as many Volcas
   as you want. The system is made of 5 different parts that you can combined
   to create your own custom setup.

---
<style>
.cults-download {
  color: white;
  background-color: #822ef5;
  padding: 1rem;
  border: none;
  cursor: pointer;
}
</style>
<div style="display: flex; justify-content: center;">
<a class="cults-download" href="https://cults3d.com/en/3d-model/gadget/modular-stand-system-for-the-korg-volca-series"><i class="fa fa-download"></i>
Download 3D Files From Cults
</a>
</div>
<br>

<style>
.example-picture:hover {
  transform: scale(2.0);
}
.example-picture {
  height: 10rem;
  width: auto;
  margin: auto;
}
</style>
<div style="display: grid; grid-template-columns: repeat(4, 1fr);">
<img class="example-picture" src="/assets/amvs-1/AMVS-1-AB-AB-3.jpg">
<img class="example-picture" src="/assets/amvs-1/AMVS-1-ABC-B-3.jpg">
<img class="example-picture" src="/assets/amvs-1/AMVS-1-example-ABCD-6.jpg">
<img class="example-picture" src="/assets/amvs-1/AMVS-1-example-ABCD-7.jpg">
</div>
<br>
<p>
Here are some examples of setups (click for dimensions and parts list):
</p>
<style>
.setups-wrapper {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  column-gap: 1rem;
  row-gap: 1rem;
  }
.setup-img-div {
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1;
  background-color:white;
}
.setup-img-div:hover {
  transform: scale(1.2);
}
.setup-img {
  max-width: 100%;
  max-height: 100%;
}
</style>
<div id="setups-grid" class="setups-wrapper">
{% for setups_cat in site.data.amvs-1-setups %}
{% for setup in setups_cat[1] %}
<a class="setup-img-div" href="setups.html#code-{{setup["code"]}}">
  <img class="setup-img" src="/assets/amvs-1/setups/{{setup.screenshots.perspective}}">
</a>
{% endfor %}
{% endfor %}
</div>
<br>

# Custom setups and parts list

You can find, [in the grid above](#setups-grid), the most common setups from 1
to 10 Volcas. If you click on one of the setup you will get a more detailed
view including the number of parts needed for the setup.

If you want to create a custom setup, here's a description of each part and how
they can be combined:

<style>
.part-container {
  display: grid;
  grid-template-columns: 1fr 3fr;
  column-gap: 1rem;
  row-gap: 1rem;
}
.part-container > img {
  background-color: white;
}

.part-detail {
  width:25%;
  display: block;
  margin: auto;
  background-color: white;
}

.part-detail:hover {
  transform: scale(3.0);
}
</style>

<div class="part-container">
<img src="/assets/amvs-1/amvs-1-a-stand.png">
<div markdown="1">

## A-stand

The first part is `A-stand`, it has two main usages:
 - Flat on the table it holds one side of a Volca at an angle of 10&deg;
 ([example here](setups.html#code-A)).
 - Vertically, attached to a `B-stand` or `Square` for stability, in which case
   the instrument is at an angle of 80&deg; ([example here](setups.html#code-CD)).

`A-stand` parts are used in pair, each one holding one side of a Volca. They
have two side connector ports to attach them lateraly to another `A-stand`. And
one hook at the back to attached them longitudinally to a `B-stand` or
`Square`.

</div>
</div>

<div class="part-container">
<img src="/assets/amvs-1/amvs-1-b-stand.png">
<div markdown="1">

## B-stand

Next is the `B-stand`, like the `A-stand` it has two main usages:
 - Flat on the table it holds one side of a Volca at an angle of 30&deg;
 ([example here](setups.html#code-B)).
 - Vertically, either alone or attached to a `Square`, in which case the
   instrument is at an angle of 60&deg; ([example here](setups.html#code-C)).

`B-stand` parts are used in pair, each one holding one side of a Volca. They
have two side connector ports to attach them lateraly to another `B-stand`. And
two hooks to attached them longitudinally to a `Square`.
</div>

<img src="/assets/amvs-1/amvs-1-square.png">
<div markdown="1">

## Square

`Square` parts are used as a platform to raise vertical `A-stand` or `B-stand`
to create a 3rd row of volcas. Like the `A-stand` and `B-stand`, `Square` are
used in pair. `Square` parts have four hooks to attached them longitudinally to
`A-stand`s and/or `B-stand`s.

</div>

<img src="/assets/amvs-1/amvs-1-connector.png">
<div markdown="1">

## Connector

`Connector` are snap-fit pieces used to hold stands side by side.

Three dimenstions of connectors are provided (3cm, 5cm, 10cm). The 3cm
`Connector` is recommend to attach stands side by side without any gap between
the Volcas.

<img class="part-detail" src="/assets/amvs-1/amvs-1-side-connection.png">

</div>
<img class="part-img" src="/assets/amvs-1/amvs-1-key.png">
<div markdown="1">

## Key

`Key` parts are small tapered pieces press fitted in hook connections to secure
them in place. When attached, `A-stand` parts use one key while `B-stand` use
two keys.

<img class="part-detail" src="/assets/amvs-1/amvs-1-hook-and-key-zoom.png">

</div>

</div>

# 3D Printing Instructions

The parts are designed to be printed flat on the print bed, without any
support. The recommended layer height is 0.2mm. You can experiment with
different layer height for faster printing, however keep in mind the tolerances
for interconnecting parts.

Most of the parts work by pair, so you can always print 2 of the A-stand, 2 of
the B-stand, 2 of the Square, and 2 of the connectors.

