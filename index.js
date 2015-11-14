function getTrendingWikiArticles() {
	var props = {
		page: 'Wikipedia:5000',
		action: 'parse',
		prop: 'text'
	};

	return wikiClient(props);
}

/*
	Basic wikipedia JS API
*/
function wikiClient(props) {
	var url = 'https://en.wikipedia.org/w/api.php?';
	props.format = 'json';
	props.redirects = true;

	var queries = [];
	for (var key in props) {
		queries.push(key + '=' + props[key]);
	}
	url += queries.join('&');

	return getJSONP(url);
}

/*
	Promise based JSONP implementation
*/
function getJSONP(url) {
	return new Promise(function(resolve) {
		var head = document.getElementsByTagName('head')[0];

		// create unique function name
		var callbackName = '__fn' + Date.now();
		window[callbackName] = function() {
			// clean up after ourselves
			delete window[callbackName];
			head.removeChild(newScript);
			
			// pass results to the next promise
			resolve.apply(null, arguments);
		};
		
		// tell our target what function name to send
		var src = url + ( url.includes('?') ? '&' : '?' );
		src += 'callback=' + callbackName;

		// add script to head
		var newScript = document.createElement('script');
		newScript.type = 'text/javascript';
		newScript.src = src;
		head.appendChild(newScript);
	});
}

function processData(data) {
	try {
		var html = data.parse.text['*'];
	}
	catch (e) {
		console.error('Uh oh, API return format changed!');
		return;
	}

	var dummyDOM = document.createElement('html');
	dummyDOM.innerHTML = html;
	var tableRows = dummyDOM.querySelectorAll('.wikitable tr');
	var header = tableRows[0];
	var tableRows = Array.prototype.slice.call(tableRows, 1);

	var columnIndices = columnIndices(header);
	return getArticleData(tableRows, columnIndices);


	function columnIndices(header) {
		var columnIndices = {};
		
		var columnText = Array.prototype.map.call(header.querySelectorAll('th'), function(el) { return el.innerText });
		columnText.forEach(function(text, i) {
			if (text !== '') {
				columnIndices[i] = text;
			}
		});

		return columnIndices;
	}

	function getArticleData(tableRows, columnIndices) {
		var ARTICLE_COL_INDEX = 1; // 0: Rank, 1: Article, etc.

		return tableRows.map(function(row) {
			var rowCellText = Array.prototype.map.call(row.querySelectorAll('td'), function(el) { return el.innerText });
			
			var articleLink = row.querySelector('td:nth-child(' + (ARTICLE_COL_INDEX + 1) +') a');
			var articleHref = articleLink && articleLink.getAttribute('href');

			var articleData = {};
			articleData.href = articleHref;
			for (var index in columnIndices) {
				var colName = columnIndices[index];
				
				articleData[colName] = parseInt(index) === ARTICLE_COL_INDEX ?
					articleData[colName] = rowCellText[index] :
					articleData[colName] = rowCellText[index].replace(/[^0-9]/g, ''); // strip non-digit characters ?
			}

			return articleData;
		}).slice(1, 101); // todo: remove
	}
}

function d3graph(jsonData) {
	if (!window.d3) {
		return alert('Uh oh! D3 is not included on the page!');
	}

	window.jsonData = jsonData; // debug code

	var page = {
		WIDTH: 800,
		HEIGHT: 400
	};

	var margin = {
		TOP: 30,
		RIGHT: 0,
		BOTTOM: 30,
		LEFT: 100
	};

	// define canvas using page and margin sizes
	var canvas = {
		width: page.WIDTH - margin.LEFT - margin.RIGHT,
		height: page.HEIGHT - margin.TOP - margin.BOTTOM
	};

	var x = d3.scale.ordinal()
		.domain(jsonData.map(function(d) { return d.Article; }))
		.rangeBands([0, canvas.width], .1, 1);
	var y = d3.scale.linear()
		.domain([jsonData[0].Views, 0])
		.range([0, canvas.height]);


		window.x = x;

	// add our chart group inside the margins
	var chart =
		d3.select('#content')
			.attr('width', page.WIDTH)
			.attr('height', page.HEIGHT)
		.append('g')
			.attr('transform', 'translate(' + margin.LEFT + ',' + margin.TOP + ')');


	// add our data
	var bar = chart.selectAll('.bar')
		.data(jsonData);

	// set up our title
	chart.append("text")
		.attr("x", canvas.width / 2)
		.attr("y", 0 - (margin.TOP / 2))
		.attr("text-anchor", "middle")
		.attr("class", "title")
		.text("This Week's Trending Wikipedia Articles");


	// set up our x axis	
	var xAxis = d3.svg.axis()
	    .scale(x)
	    .orient("bottom");
	chart.append("g")
	    .attr("class", "x axis")
	    .attr("transform", "translate(0," + canvas.height + ")")
	    .call(xAxis);

	// set up our y axis
	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left");
	chart.append("g")
		.attr("class", "y axis")
		.call(yAxis)
		// axis label
		.append("text")
		  .attr("transform", "rotate(-90)")
		  .attr("dy", ".71em")
		  .attr("y", 10 - margin.LEFT)
		  .attr("x", 0 - (canvas.height / 2))
		  .attr("class", "label")
		  .style("text-anchor", "middle")
		  .text("Page Views");

	bar.enter().append('rect')
		.attr('class', 'bar')
		.attr('fill', 'steelblue')
		// position
		.attr('x', function(d) { return x(d.Article); })
		.attr('width', x.rangeBand())
		.attr('y', function(d) { return y(d.Views); })
		.attr('height', function(d) { return canvas.height - y(d.Views) })
		// mouse events
		.on('mouseover', barMouseOver)
		.on('click', barClick)
		.on('mouseout', barMouseOut);

	function barMouseOver(d, x) {
		var bar = d3.select(this);
		bar.attr('fill', 'brown');

		var n = x + 1; // CSS is 1-indexed
		d3.select('.x.axis .tick:nth-child(' + n + ')').style('display', 'block');
	}

	function barClick(d, x) {
		window.open('https://wikipedia.org/' + d.href, '_target');
	}

	function barMouseOut(d, x) {
		var bar = d3.select(this);
		bar.attr('fill', 'steelblue');
		
		var n = x + 1; // CSS is 1-indexed
		d3.select('.x.axis .tick:nth-child(' + n + ')').style('display', 'none');
	}
}


getTrendingWikiArticles()
	.then(processData)
	.then(d3graph)
