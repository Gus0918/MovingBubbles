// global variables
var height_offset = 30;

function get_leaves(dat, width, height){
  return d3.pack().size([width, height - height_offset]).padding(5)(
    d3.hierarchy({children: dat})
    .sum(d => d.value)
  ).leaves();
}

function calculate_area_to_value_ratio(leaves, bubble_size){
  return Math.pow(leaves[0].r,2) / leaves[0].value * bubble_size;
}

function update_leaves(leaves, dat, frames, j, area_to_value_ratio){
  for(let i = 0; i < leaves.length; i++){
    let result = dat.filter(d => d.frame == frames[j]).filter(d => d.key == leaves[i].data.key)
    leaves[i].r = (result.length !== 0) ? Math.sqrt(result[0].value*area_to_value_ratio) : 0;
  }
  return leaves;
}

function update_frame(j, leaves, dat, frames, area_to_value_ratio, circles, labels, force){

  // update leaves to next j
  leaves = update_leaves(leaves, dat, frames, j, area_to_value_ratio);

  // transition setting for circles and labels
  let t = d3.transition().duration(1000)
  .ease(d3.easeLinear).tween('update', function(d) {
    return function(t) { 
      force.nodes(leaves); 
      force.alphaTarget(0.3)
        .restart(); 
      };
  })

  // transition circles and labels
  circles.transition(t).attr("r", d => d.r.toFixed(1));
  labels.transition(t)
    .attr("font-size", function(d) { return Math.round(2 * d.r * 0.2 * font_size) + "px"; });

  // transition titles
  setTimeout(() => d3.select("p#title").text(frames[j]), 1000);
}

HTMLWidgets.widget({

  name: 'MovingBubbles',

  type: 'output',

  factory: function(el, width, height) {

    // declare variables
    var svg = d3.select(el).append("svg")
      .attr("id", "MovingBubbles")
      .attr("width", width)
      .attr("height", height - height_offset);
    var area_to_value_ratio;
    var bubble_size;
    var force;
    var starting_dat;
  
    return {

      renderValue: function(opts) {

        // get data from R
        let dat = HTMLWidgets.dataframeToD3(opts[0]);
        let frames = opts[1];
        starting_dat = HTMLWidgets.dataframeToD3(opts[2]);
        bubble_size = opts[3];
        font_size = opts[4];

        // calculate leaves
        var leaves = get_leaves(starting_dat, width, height);

        // calculate area_to_value_ratio
        area_to_value_ratio = calculate_area_to_value_ratio(leaves, bubble_size);
        
        // reset to first frame
        leaves = update_leaves(leaves, dat, frames, 0, area_to_value_ratio);

        // add title
        d3.select(el).append("p")
          .attr("id", "title")
          .style("margin-top", 0)
          .style("margin-bottom", 0)
          .style("position", "absolute")
          .style("text-align", "center")
          .style("width", "100%")
          .text(frames[0]);

        // add bubbles
        let circles = svg.selectAll("circle")
          .data(leaves)
          .enter().append("circle")
            .attr("cx", d => d.x.toFixed(1))
            .attr("cy", d => d.y.toFixed(1))
            .attr("r", d => d.r.toFixed(1))
            .attr("id", d => d.data.key)
            .style("fill", d => d.data.color)
            .each(function(d){
              // add dynamic r getter
              var n = d3.select(this);
              Object.defineProperty(d, "rt", {get: function(){
                return +n.attr("r");
                }})
              });
        
        // add text inside bubbles
        var labels = svg.selectAll("text")
        .data(leaves)
        .enter().append("text")
          .text(d => d.data.key)
          .attr("x", d => d.x.toFixed(1))
          .attr("y", d => d.y.toFixed(1))
          .attr("font-size", function(d) { return Math.round(2 * d.r * 0.2 * font_size) + "px" })
          .attr("fill", "#dfdfdf")
          .attr("text-anchor", "middle");
        
        force = d3.forceSimulation(leaves)
          .force("charge", d3.forceManyBody().strength(5 + Math.round(Math.min(width, height) / 100)))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collide", d3.forceCollide().radius(d => d.rt + 5).strength(0.7))
          .on("tick", function(e) {
            svg.selectAll("circle")
              .attr("cx", d => d.x.toFixed(1))
              .attr("cy", d => d.y.toFixed(1));
            svg.selectAll("text")
              .attr("x", d => d.x.toFixed(1))
              .attr("y", d => d.y.toFixed(1));
            })
          .stop();
        
        // initialize simulation
        for (let i = 0; i < 200; ++i) { force.tick(); }
        force.alphaTarget(0.3)
          .restart();

        // change frame at interval
        let j = 1;
        d3.interval(function() {
          update_frame(j, leaves, dat, frames, area_to_value_ratio, circles, labels, force);
          j++;
          if (j == frames.length) { j = 0; } // loop
        }, 1500);

      },

      resize: function(width, height) {

        // update svg size
        svg.attr("width", width)
          .attr("height", height - height_offset);

        // recalculate area_to_value_ratio
        let leaves_tmp = get_leaves(starting_dat, width, height);
        area_to_value_ratio = calculate_area_to_value_ratio(leaves_tmp, bubble_size);

        // update force
        force.force("center", d3.forceCenter(width / 2, (height - height_offset) / 2))
        force.force("charge", d3.forceManyBody().strength(5 + Math.round(Math.min(width, height) / 100)))
        }
    }
  }
});