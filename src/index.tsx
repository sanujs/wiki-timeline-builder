import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './style.css';

const App = () => {
	const SUGGESTION_LIMIT = 5;
	const [search, setSearch] = useState('');
	const [error, setError] = useState(null);
	const [suggestions, setSuggestions] = useState([]);
	const [selectedEvents, setSelectedEvents] = useState([]);

	useEffect(() => {
		const paramsObj = {
			origin: "*",
			action: "query",
			format: "json",
			generator: "prefixsearch",
			prop: "pageprops|pageimages|description",
			ppprop: "displaytitle",
			piprop: "thumbnail",
			pithumbsize: "75",
			pilimit: "6",
			gpssearch: search,
			gpsnamespace: "0",
			gpslimit: "6",
		}
		fetch("https://en.wikipedia.org/w/api.php?" + new URLSearchParams(paramsObj).toString(), {
			method: "GET",
			headers: {
				"Origin": "*"
			}
		})
			.then(response => {
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				if ("error" in response) {
					if (response["error"]["code"] != "missingparam") {
						setError(response["error"])
					}
					return
				}
				const newState = Object.keys(response.query.pages).map(key => response.query.pages[key])
				setSuggestions(newState)
			})
	}, [search])

	async function getWikiPage(choice) {
		await fetch("https://en.wikipedia.org/w/api.php?origin=*&action=parse&format=json&prop=text&page=" + choice.title)
			.then(response => {
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				console.log(response)
				const parser = new DOMParser();
				const htmlDoc = parser.parseFromString(response.parse.text['*'], 'text/html')
				const xpath = "//th[text()='Date']";
				const infoboxDateHeader = htmlDoc.evaluate(xpath, htmlDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
				const date = infoboxDateHeader.nextSibling.textContent;
				// Regex handles "dd month yyyy" or "month dd, yyyy"
				const regex = /(\d{1,2}\s[A-Z]\w+\s{1}\d{4})|([A-Z]\w+\s\d{1,2},\s\d{4})/g;
				console.log(date)
				console.log(date.match(regex))
				console.log(Date.parse(date.match(regex)[0]))
			})
	}

	const userSelect = (choice) => {
		getWikiPage(choice)
		setSearch('')
		setSuggestions([])
		setSelectedEvents([...selectedEvents, ])
	}

	return (
		<div>
			<h1>Get Started building a beautiful timeline</h1>
			<Search value={search} setSearch={setSearch} suggestions={suggestions} userSelect={userSelect}/>
		</div>
	);
}

const Search = (props: any) => {
	const searchSuggestions = props.suggestions.map(suggestion =>
		<li>
			<div className="suggestion" onClick={_ => props.userSelect(suggestion)}>{suggestion.title}</div>
		</li>
	);
	return (
		<div id="search">
			<input
				value={props.value}
				onInput={e => { const { value } = e.target as HTMLInputElement; props.setSearch(value) }}
			></input>
			<div id="suggestions">
				<ul>{searchSuggestions}</ul>
			</div>
		</div>
	)
}

render(<App />, document.getElementById('app'));
