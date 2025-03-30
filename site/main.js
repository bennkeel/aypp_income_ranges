import { readCSV } from "./scripts/loadCSV.js";

// Keep track of the active building
let currentBuilding = 'B2';
let currentYear = '2016.6';

// Define color mappings for income bands
const incomeBandColors = [
  { band: 1, bandNum: 1, label: "Low Income: 30-40% AMI", color: "#663399" },
  { band: 2, bandNum: 2, label: "Low Income: 40-60% AMI", color: "#9370DB" },
  { band: 3, bandNum: 3, label: "Moderate Income: 60-100% AMI", color: "#CD5C5C" },
  { band: 4, bandNum: 4, label: "Middle Income: 100-140% AMI", color: "#FF8C69" },
  { band: 5, bandNum: 5, label: "Middle Income: 140-165% AMI", color: "#FFD700" }
];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Populate the income range legend
  createIncomeLegend();
  
  // Set up button click handlers
  const buttons = document.querySelectorAll('.building-button');
  buttons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      buttons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Get building data from button data attributes
      currentBuilding = this.getAttribute('data-building');
      currentYear = this.getAttribute('data-year');
      
      // Update the title and subtitle
      updateTitle(currentBuilding, currentYear);
      
      // Load the data for the selected building
      loadBuildingData(currentBuilding);
    });
  });
  
  // Load initial data (B2)
  loadBuildingData('B2');
});

// Create the income range legend
function createIncomeLegend() {
  const legendContainer = document.getElementById('income-legend');
  
  // Clear any existing content
  legendContainer.innerHTML = '';
  
  // Add each income band to the legend
  incomeBandColors.forEach(band => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    
    const colorCircle = document.createElement('div');
    colorCircle.className = 'color-circle';
    colorCircle.style.backgroundColor = band.color;
    
    const text = document.createElement('div');
    text.className = 'legend-text';
    text.textContent = band.label;
    
    item.appendChild(colorCircle);
    item.appendChild(text);
    
    legendContainer.appendChild(item);
  });
}

function updateTitle(building, year) {
  document.getElementById('title').textContent = `${building}: Housing Income Ranges`;
  document.getElementById('subtitle').textContent = `Qualifying Household Income Range For All Affordable Units, ${year}`;
}

function loadBuildingData(building) {
  // Create the file path based on the building
  const filePath = `../exports/units_ranges_long_${building.replace('-', '_')}.csv`;
  
  // Update the readCSV function to use the dynamic file path
  readCSVWithPath(filePath, onInventoryLoadSuccess);
}

function readCSVWithPath(filePath, onSuccess, onFailure) {
  fetch(filePath)
    .then(resp => {
      if (resp.status === 200) {
        return resp.text();
      } else {
        alert(`Failed to load data for ${currentBuilding}`);
        if (onFailure) {onFailure();}
      }
    })
    .then(text => {
      const data = d3.csvParse(text);
      return data;
    })
    .then(onSuccess)
    .catch(error => {
      console.error("Error loading data:", error);
      alert(`Error loading data for ${currentBuilding}: ${error.message}`);
    });
}

function onInventoryLoadSuccess(data) {
    drawGraph(data);
}

function drawGraph(data) {
    console.log(data);

    // Process data to group by Income Band & Unit Type
    const processedData = [];
    const groups = {};

    data.forEach(d => {
        const groupKey = d['Income Band & Unit Type'];
        const rent = parseInt(d.rent.replace('$', ''));
        const income = parseInt(d['Annual Household Income']);
        const limitCategory = d.limit_category;
        const incomeRange = d['Income Band'];
        const unitType = d['Unit Type'];
        const bandNum = parseInt(d.band_num);
        const count = parseInt(d.count);

    if (!groups[groupKey]) {
        groups[groupKey] = {
        key: groupKey,
        rent,
        incomeRange,
        unitType,
        bandNum,
        count,
        incomes: {}
        };
    }

    groups[groupKey].incomes[limitCategory] = income;
    });

    Object.values(groups).forEach(group => {
    processedData.push({
        key: group.key,
        rent: group.rent,
        lowerIncome: group.incomes['Lower Limit'],
        upperIncome: group.incomes['Upper Limit'],
        incomeRange: group.incomeRange,
        unitType: group.unitType,
        bandNum: group.bandNum,
        count: group.count
    });
    });

    // Create responsive chart function
    function createChart() {
    // Clear any existing chart
    d3.select("#chart").html("");

    // Get the current width of the container
    const containerWidth = document.getElementById("chart").clientWidth;

    // Set chart dimensions based on container width
    const aspectRatio = 0.6; // height to width ratio
    const isMobile = containerWidth < 600;

    // Set margins based on screen size
    const margin = isMobile ? 
        { top: 10, right: 20, bottom: 50, left: 60 } : 
        { top: 10, right: 20, bottom: 50, left: 60 };
        
    const width = containerWidth - margin.left - margin.right;
    const height = Math.min(containerWidth * aspectRatio, 600) - margin.top - margin.bottom;

    // Create SVG with viewBox for responsiveness
    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip");

    // Set up scales
    const xScale = d3.scaleLinear()
        .domain([20000, 200000])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, 4000])
        .range([height, 0]);

    // Create color scale based on band number
    const colorScale = d3.scaleOrdinal()
        .domain([1, 2, 3, 4, 5])
        .range(['#663399', '#9370DB', '#CD5C5C', '#FF8C69', '#FFD700']);

    // Create size scale based on count
    const sizeScale = d3.scaleSqrt()  // Using square root scale for better visual representation
        .domain([1, 30])  // Domain from min to max count
        .range([3, 12]);  // Range of sizes in pixels

    // Add X axis
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
        .tickFormat(d => `$${d/1000}k`)
        .ticks(isMobile ? 5 : 10))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(yScale)
        .tickFormat(d => `$${d}`)
        .ticks(isMobile ? 5 : 10));

    // Add X axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2 )
        .attr("y", height + (isMobile ? margin.bottom : margin.bottom ))
        .text("Annual Household Income");

    // Add Y axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + (isMobile ? 15 : 15))
        .text("Rent");

    // Add gridlines with slightly darker gray
    const gridColor = "#e0e0e0";

    svg.selectAll("xGrid")
        .data(xScale.ticks(isMobile ? 5 : 10))
        .join("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", gridColor)
        .attr("stroke-width", 0.5);

    svg.selectAll("yGrid")
        .data(yScale.ticks(isMobile ? 5 : 10))
        .join("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", gridColor)
        .attr("stroke-width", 0.5);

    // Create a group for each data point to hold the line and endpoints
    const lineGroups = svg.selectAll(".line-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "line-group")
        .attr("data-key", d => d.key);

    // Add horizontal lines (connecting the income ranges)
    lineGroups.append("line")
        .attr("class", "income-line")
        .attr("x1", d => xScale(d.lowerIncome))
        .attr("x2", d => xScale(d.upperIncome))
        .attr("y1", d => yScale(d.rent))
        .attr("y2", d => yScale(d.rent))
        .attr("stroke", d => colorScale(d.bandNum))
        .attr("stroke-width", isMobile ? 4 : 3);

    // Add vertical line at the starting point
    lineGroups.append("line")
        .attr("class", "start-marker")
        .attr("x1", d => xScale(d.lowerIncome))
        .attr("x2", d => xScale(d.lowerIncome))
        .attr("y1", d => yScale(d.rent) - 5) // 10px tall, centered
        .attr("y2", d => yScale(d.rent) + 5)
        .attr("stroke", d => colorScale(d.bandNum))
        .attr("stroke-width", isMobile ? 4 : 3);

    // Function to draw shapes that scale based on count
    function addShape(selection, unitType, d) {
        const size = sizeScale(d.count);
        
        if (unitType === 'Studio') {
          // Circle for Studio
          selection
              .append("circle")
              .attr("class", "shape")
              .attr("r", size)
              .attr("fill", colorScale(d.bandNum))
              .attr("stroke", "black")
              .attr("stroke-width", isMobile ? 2 : 1.5)
              .attr("data-key", d.key);
        } else if (unitType === '1-Bed') {
          // Square for 1-Bedroom
          const rectSize = size * 1.5;
          selection
              .append("rect")
              .attr("class", "shape")
              .attr("x", -rectSize/2)
              .attr("y", -rectSize/2)
              .attr("width", rectSize)
              .attr("height", rectSize)
              .attr("fill", colorScale(d.bandNum))
              .attr("stroke", "black")
              .attr("stroke-width", isMobile ? 2 : 1.5)
              .attr("data-key", d.key);
        } else if (unitType === '2-Bed') {
          // Triangle for 2-Bedroom
          const triangleSize = size * 1.8;
          selection
              .append("polygon")
              .attr("class", "shape")
              .attr("points", `0,${-triangleSize} ${triangleSize*0.866},${triangleSize/2} ${-triangleSize*0.866},${triangleSize/2}`)
              .attr("fill", colorScale(d.bandNum))
              .attr("stroke", "black")
              .attr("stroke-width", isMobile ? 2 : 1.5)
              .attr("data-key", d.key);
        } else if (unitType === '3-Bed') {
          // Diamond for 3-Bedroom
          const diamondSize = size * 1.8;
          selection
              .append("polygon")
              .attr("class", "shape")
              .attr("points", `0,${-diamondSize} ${diamondSize},0 0,${diamondSize} ${-diamondSize},0`)
              .attr("fill", colorScale(d.bandNum))
              .attr("stroke", "black")
              .attr("stroke-width", isMobile ? 2 : 1.5)
              .attr("data-key", d.key);
        }
    }

    // Add shapes only at the upper income limit (right side)
    const shapeGroups = svg.selectAll(".shape-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "shape-group")
        .attr("transform", d => `translate(${xScale(d.upperIncome)},${yScale(d.rent)})`)
        .attr("data-key", d => d.key)
        .on("mouseover", function(event, d) {
            // Determine which side of the screen the mouse is on
            const mouseX = event.pageX;
            const windowWidth = window.innerWidth;
            const isRightSide = mouseX > windowWidth / 2;
            
            // Position tooltip to the left if on right side, right if on left side
            const tooltipX = isRightSide ? 
                mouseX - 320 : // Left side of mouse (with offset)
                mouseX + 20;   // Right side of mouse (with offset)
                
            tooltip
                .style("opacity", 1)
                .html(`
                <div><strong>Unit Type:</strong> ${d.unitType}</div>
                <div><strong>Income Range:</strong> ${d.incomeRange}</div>
                <div><strong>Lower Income:</strong> $${d.lowerIncome.toLocaleString()}</div>
                <div><strong>Upper Income:</strong> $${d.upperIncome.toLocaleString()}</div>
                <div><strong>Rent:</strong> $${d.rent}</div>
                <div><strong>Count:</strong> ${d.count}</div>
                `)
                .style("left", tooltipX + "px")
                .style("top", (event.pageY - 28) + "px");
            
            // Highlight the corresponding line
            const key = d.key;
            
            // Increase the shape's stroke width
            d3.select(this).select(".shape")
                .attr("stroke-width", isMobile ? 4 : 3);
        })
        .on("mouseout", function(event, d) {
            // Remove tooltip
            tooltip.style("opacity", 0);
            
            // Remove the highlight background line
            d3.selectAll(".highlight-background").remove();
            
            // Reset the shape's stroke width
            d3.select(this).select(".shape")
                .attr("stroke-width", isMobile ? 2 : 1.5);
        });

    // Apply appropriate shape for each data point
    shapeGroups.each(function(d) {
        addShape(d3.select(this), d.unitType, d);
    });
    }

    // Create the chart initially
    createChart();

    // Re-render chart on window resize
    window.addEventListener('resize', function() {
    // Remove old tooltip to prevent duplicates
    d3.selectAll(".tooltip").remove();

    // Debounce the resize event
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(createChart, 250);
    });
}