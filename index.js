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
		console.error('Unexpected data format!', data);
		return;
	}

	var dummyDOM = document.createElement('html');
	dummyDOM.innerHTML = html;
	var tableRows = dummyDOM.querySelectorAll('.wikitable tr');
	var header = tableRows[0];
	var tableRows = Array.prototype.slice.call(tableRows, 1);

	var columnIndices = extractColumnIndices(header);
	return getArticleData(tableRows, columnIndices);


	function extractColumnIndices(header) {
		var columnIndices = {};

		var columnText = Array.prototype.map.call(header.querySelectorAll('th'), function(el) { return el.innerText.trim() });
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

				articleData[colName] = articleData[colName].trim();
			}

			return articleData;
		})
			.filter(function(row) {
				// Sometimes "-" is marked as trending. Ignore that and other non-articles.
				return row.Article.length > 1;
			})
			.slice(1, 21);
	}
}

function d3graph(jsonData) {
	if (!window.d3) {
		return alert('Uh oh! D3 is not included on the page!');
	}

	var page = {
		WIDTH: 800,
		HEIGHT: 600
	};

	var margin = {
		TOP: 30,
		RIGHT: 30,
		BOTTOM: 30,
		LEFT: 30
	};

	// define canvas using page and margin sizes
	var canvas = {
		width: page.WIDTH - margin.LEFT - margin.RIGHT,
		height: page.HEIGHT - margin.TOP - margin.BOTTOM
	};

	var x = d3.scale.linear()
		.domain([jsonData[0].Views, 0])
		.range([0, canvas.width]);
	var y = d3.scale.ordinal()
		.domain(jsonData.map(function(d) { return d.Article; }))
		.rangeBands([0, canvas.height], .1, 1);

	// add our chart group inside the margins
	var chart =
		d3.select('#content')
			.attr('width', page.WIDTH)
			.attr('height', page.HEIGHT)
			.style('overflow', 'visible')
		.append('g')
			.attr('transform', 'translate(' + margin.LEFT + ',' + margin.TOP + ')');

	// set up our title
	chart.append("text")
		.attr("x", canvas.width / 2)
		.attr("y", 0)
		.attr("text-anchor", "middle")
		.attr("class", "title")
		.text("This Week's Trending Wikipedia Articles");

	// add our data
	var bar = chart.selectAll('.bar')
		.data(jsonData);

	// set up our bars
	bar.enter().append('rect')
		.attr('class', 'bar')
		.attr('fill', 'steelblue')
		// position
		.attr('x', 0)
		.attr('width', function(d) { return canvas.width - x(d.Views); })
		.attr('y', function(d) { return y(d.Article); })
		.attr('height', y.rangeBand())
		// mouse events
		.on('mouseover', barMouseOver)
		.on('click', barClick)
		.on('mouseout', barMouseOut);

	// set up our y axis
	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left")
	chart.append("g")
		.attr("class", "y axis")
		.call(yAxis)
		.selectAll("text")
			.attr("x", "10")
			.style("text-anchor", "start")
			.style("fill", "white");


	var labelCountFormat = d3.format(",");
	chart.selectAll(".label-count")
		.data(jsonData).enter()
		.append('text')
			.attr('class', 'label-count')
			.attr('x', function(d) { return canvas.width - x(d.Views); })
			.attr('y', function(d) { return y(d.Article) + (y.rangeBand() / 2) })
			.attr("dx", 5)
	  		.attr("dy", ".36em")
			.text(function(d) { return labelCountFormat(d.Views); });

	function barMouseOver() {
		var bar = d3.select(this);
		bar.attr('fill', 'brown');
	}

	function barClick(d) {
		window.open('https://wikipedia.org/' + d.href, '_target');
	}

	function barMouseOut() {
		var bar = d3.select(this);
		bar.attr('fill', 'steelblue');
	}
}

getTrendingWikiArticles()
	.then(processData)
	.then(d3graph);
