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

	return new Promise(function(resolve) {
		getJSON(url, resolve);
	});
}

/*
	Basic JSONP implementation
*/
function getJSON(url, callback) {
	var head = document.getElementsByTagName('head')[0];

	var callbackName = '__fn' + Date.now();
	window[callbackName] = function() {
		delete window[callbackName];
		head.removeChild(newScript);
		callback.apply(null, arguments);
	};
	
	var src = url + ( url.includes('?') ? '&' : '?' );
	src += 'callback=' + callbackName;

	var newScript = document.createElement('script');
	newScript.type = 'text/javascript';
	newScript.src = src;
	head.appendChild(newScript);
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

	var page = {
		WIDTH: 600,
		HEIGHT: 400
	};

	var margin = {
		TOP: 30,
		RIGHT: 30,
		BOTTOM: 30,
		LEFT: 30
	};

	var canvas = {
		width: page.WIDTH - margin.LEFT - margin.RIGHT,
		height: page.HEIGHT - margin.TOP - margin.BOTTOM
	};

	var x = d3.scale.linear()
			.domain([0, jsonData.length])
			.range([0, canvas.width]);
	var y = d3.scale.linear()
			.domain([jsonData[0].Views, 0])
			.range([0, canvas.height]);


	var chart =
		d3.select('#content')
			.attr('width', page.WIDTH)
			.attr('height', page.HEIGHT)
		.append('g')
			.attr('transform', 'translate(' + margin.LEFT + ',' + margin.TOP + ')');

	var bar = chart.selectAll('.bar')
		.data(jsonData);

	var xAxisScale = d3.scale.ordinal()
			.domain(jsonData.map(function(d) { return d.Article; }))
			.rangePoints([0, canvas.width]);

	var xAxis = d3.svg.axis()
	    .scale(xAxisScale)
	    .orient("bottom");

	chart.append("g")
	    .attr("class", "x axis")
	    .attr("transform", "translate(0," + canvas.height + ")")
	    .call(xAxis);

	bar.enter().append('rect')
		.attr('class', 'bar')
		.attr('x', function(d, i) { return x(i); })
		.attr('width', 5) // TODO: do this with scale fn
		.attr('y', function(d) { return y(d.Views); })
		.attr('height', function(d) { return canvas.height - y(d.Views) })
		.attr('fill', 'steelblue')
		.on('mouseover', barMouseOver)
		.on('mouseout', barMouseOut);

	function barMouseOver(d, x) {
		var bar = d3.select(this);
		bar.attr('fill', 'red');
		d3.select('.x.axis .tick:nth-child(' + x + ')').style('display', 'block');

	}

	function barMouseOut(d, x) {
		var bar = d3.select(this);
		bar.attr('fill', 'steelblue');
		d3.select('.x.axis .tick:nth-child(' + x + ')').style('display', 'none');
	}
}


getTrendingWikiArticles()
	.then(processData)
	.then(d3graph)
