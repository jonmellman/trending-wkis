/*
	Basic JSONP implementation
*/
function getJSON(url, callback) {
	var head = document.getElementsByTagName('head')[0];

	var callbackName = '__fn' + Date.now();
	window[callbackName] = function() {
		delete window[callbackName]; //
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

/*
	Basic wikipedia JS API
*/
function wikiClient(props, callback) {
	var url = 'https://en.wikipedia.org/w/api.php?';
	props.format = 'json';
	props.redirects = true;

	var queries = [];
	for (var key in props) {
		queries.push(key + '=' + props[key]);
	}
	url += queries.join('&');

	return getJSON(url, callback);
}

var props = {
	page: 'Wikipedia:5000',
	action: 'parse',
	prop: 'text'
};

wikiClient(props, init);

function init(data) {
	json = processData(data);
	console.log('got mah json!', json)
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
	var body = Array.prototype.slice.call(tableRows, 1);

	var columnIndices = columnIndices(header);
	return getArticleData(body, columnIndices);


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

	function getArticleData(body, columnIndices) {
		var ARTICLE_COL_INDEX = 1; // 0: Rank, 1: Article, etc.
		var i = 0;
		return body.map(function(row) {
			var rowCellText = Array.prototype.map.call(row.querySelectorAll('td'), function(el) { return el.innerText });
			
			var articleLink = row.querySelector('td:nth-child(' + (ARTICLE_COL_INDEX + 1) +') a');
			var articleHref = articleLink && articleLink.getAttribute('href');

			var articleData = {};
			articleData.href = articleHref;
			for (var index in columnIndices) {
				var colName = columnIndices[index];
				articleData[colName] = rowCellText[index];
			}
			i++;
			return articleData;
		});
	}
}

