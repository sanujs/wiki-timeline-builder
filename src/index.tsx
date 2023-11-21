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
		fetch("https://en.wikipedia.org/w/api.php?origin=*&action=opensearch&format=json&limit=" + SUGGESTION_LIMIT + "&search=" + search, {
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
				const newState = response[1].map((title, index) => { return { title, url: response[3][index] } })
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
				// console.log(htmlDoc)
				const xpath = "//th[text()='Date']";
				// const doc = htmlDoc.getElementsByClassName('infobox vevent')[0]
				const infoboxDateHeader = htmlDoc.evaluate(xpath, htmlDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
				console.log(infoboxDateHeader.nextSibling)
			})
	}

	const userSelect = (choice) => {
		getWikiPage(choice)
		setSearch('')
		setSuggestions([])

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
