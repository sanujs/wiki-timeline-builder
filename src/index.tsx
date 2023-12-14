import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { SetStateAction } from 'preact/compat';
import './style.css';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

type WikiSuggestion = {
	description: string,
	descriptionsource?: string,
	index: number,
	ns?: number,
	pageid: number,
	title: string
}

const App = () => {
	const [search, setSearch] = useState('');
	const [error, setError] = useState(null);
	const [suggestions, setSuggestions] = useState([]);
	const [queryResults, setQueryResults] = useState({});
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const paramsObj = {
			origin: "*",
			action: "query",
			format: "json",
			generator: "prefixsearch",
			prop: "pageprops|pageimages|description",
			redirects: "",
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
					} else {
						setSuggestions([])
					}
					return
				}
				const pages: { [key: number]: WikiSuggestion } = response.query.pages;
				const newState: WikiSuggestion[] = [];
				Object.keys(pages).forEach(key => {newState[pages[key]["index"]-1] = pages[key]})
				setSuggestions(newState)
			})
	}, [search])

	const userSelectWikiData = (choice: WikiSuggestion): void => {
		setSearch('');
		setSuggestions([]);
		setLoading(true);
		// Get wikibase item number from wikipedia title
		const paramsObj = {
			origin: "*",
			action: "query",
			format: "json",
			prop: "pageprops",
			ppprop: "wikibase_item",
			formatversion: "2",
			titles: choice.title,
		}
		fetch("https://en.wikipedia.org/w/api.php?" + new URLSearchParams(paramsObj).toString())
			.then(response => {
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				console.log(response);
				const itemID = response.query.pages[0].pageprops.wikibase_item;
				console.log(itemID);
				// https://w.wiki/8UZ9
				const query = `
				SELECT ?propertyItemLabel ?valueLabel ?qualifierItemLabel ?pointintime ?precision ?oqpLabel ?oqvLabel WHERE {
					{
					  wd:${itemID} ?property [?pValue ?valuenode].
					  ?propertyItem wikibase:statementValue ?pValue.
					  ?valuenode wikibase:timeValue ?pointintime.
					  ?valuenode wikibase:timePrecision ?precision.
					  BIND(?pointintime as ?value).
					  BIND(?propertyItem as ?qualifierItem).
					}
					UNION
					{
					  wd:${itemID} ?property ?statement.
					  ?statement ?pValue ?valuenode.
					  ?qualifierItem wikibase:qualifierValue ?pValue.
					  ?valuenode wikibase:timeValue ?pointintime.
					  ?valuenode wikibase:timePrecision ?precision.
					  
					  ?statement ?ps ?value.
					  ?propertyItem wikibase:statementProperty ?ps.
					  ?statement ?otherQualifierProperty ?oqv.
					  ?oqp wikibase:qualifier ?otherQualifierProperty.
					}
					SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
				  }
				`
				return fetch("https://query.wikidata.org/sparql?origin=*&format=json&query=" + query);
			})
			.then(response => {
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				console.log("response: ", response)
				const results: any[] = response.results.bindings;
				let qr: QueryResult = {};

				for (const result of results) {
					const event: string = result.propertyItemLabel.value + ":" + result.valueLabel.value;
					if (!(result.pointintime.value in qr)) {
						qr[result.pointintime.value] = {
							date: {
								'property': result.qualifierItemLabel.value,
								'item': dayjs(result.pointintime.value),
								'precision': parseInt(result.precision.value),
							},
							events: {},
						}
					}
					if (!(event in qr[result.pointintime.value].events)) {
						qr[result.pointintime.value].events[event] = {
							qualifiers: [],
							propertyStatement: {
								'property': result.propertyItemLabel.value,
								'item': result.valueLabel.value,
							},
						}
					}
					if ('oqpLabel' in result) {
						const newQualifier: WikidataItem = {
							'property': result.oqpLabel.value,
							'item': result.oqvLabel.value,
						}
						// Ignore duplicate qualifiers
						if (result.oqpLabel.value != result.qualifierItemLabel.value &&
							!qr[result.pointintime.value].events[event].qualifiers.some(e =>
								e.property == newQualifier.property && e.item == newQualifier.item
							)
						)
							qr[result.pointintime.value].events[event].qualifiers.push(newQualifier);
					}
				}
				setLoading(false);
				setQueryResults(qr);
			})
	}
	useEffect(()=>{console.log("QR:", queryResults)}, [queryResults])

	return (
		<div>
			<h1>Get started building a beautiful timeline</h1>
			<Search value={search} setSearch={setSearch} suggestions={suggestions} userSelect={userSelectWikiData}/>
			{loading ? <h1>Loading...</h1> : <Timeline qrs={queryResults}/>}
		</div>
	);
}

type WikidataDate = {
	property: string,
	item: dayjs.Dayjs,
	precision?: number,
}
type WikidataItem = {
	property: string,
	item: string,
	precision?: number,
}
type TimelineCard = {
	date: WikidataDate,
	events: {
		[key: string]: { // Event (formatted as "<propertyitem>:<valueitem>")
			propertyStatement: WikidataItem,
			qualifiers: WikidataItem[],
		}
	}
}

type QueryResult = {
	[key: string]: TimelineCard
}

/**************
 ********* Search component
 **************/
type SearchProps = {
	value: string,
	suggestions: WikiSuggestion[],
	userSelect: (WikiSuggestion)=>void,
	setSearch: SetStateAction<string>,
}

const Search = (props: SearchProps) => {
	const searchSuggestions = props.suggestions.map(suggestion =>
		<li>
			<div
				className="suggestion"
				onClick={_ => props.userSelect(suggestion)}
			>
				<div className="suggestion-text">
					<h4>{suggestion.title}</h4>
					<p className="suggestion-description">{suggestion.description}</p>
				</div>
				<div
					className="suggestion-thumbnail"
				>
				</div>
			</div>
		</li>
	);
	return (
		<div id="search">
			<input
				value={props.value}
				onInput={e => { const { value } = e.target as HTMLInputElement; props.setSearch(value) }}
			></input>
			<div id="suggestions">
				{searchSuggestions}
			</div>
		</div>
	)
}

/**************
 ********* Timeline Component
 **************/


type TimelineProps = {
	qrs: QueryResult,
}

const Timeline = (props: TimelineProps) => {
	const fixDateString = (item: string | dayjs.Dayjs, precision: number) : string => {
		switch (typeof item) {
			case "string":
				if (dayjs(item, "YYYY-MM-DDTHH:mm:ssZ").isValid()) {
					return formatUsingPrecision(dayjs(item), precision);
				}
				break;
			case "object":
				return formatUsingPrecision(item, precision);
		}
		return item;
	}
	const formatUsingPrecision = (date: dayjs.Dayjs, precision: number): string => {
		date = date.utc();
		switch(precision) {
			case 7: return date.format("YYYY").substring(0, 2) + "00s";
			case 8: return date.format("YYYY").substring(0, 3) + "0s";
			case 9: return date.format("YYYY");
			case 10: return date.format("MMMM YYYY");
			default: return date.format("MMMM DD, YYYY");
		}
	}
	let left = false;
	let timeline: TimelineCard[] = [];
	for (const [dateString, timelineCard] of Object.entries(props.qrs)) {
		const i = timeline.findIndex((curEvent => (curEvent.date.item as dayjs.Dayjs).isAfter(timelineCard.date.item)))
		if (i==-1) {
			timeline.push(timelineCard);
		} else {
			timeline = timeline.slice(0, i).concat(timelineCard, timeline.slice(i))
		}
	}
	const cards = timeline.map(card => {
		left = !left;
		return <div className={left ? "event left" : "event right"}>
				<h1>{fixDateString(card.date.item, card.date.precision)}</h1>
				{Object.values(card.events).map(event => {
					return <><h4>{`${event.propertyStatement.property}: ${fixDateString(
						event.propertyStatement.item,
						event.propertyStatement.item in props.qrs ? props.qrs[event.propertyStatement.item].date.precision : -1
					)} (${card.date.property})`}</h4>
					{'qualifiers' in event && event.qualifiers.map(q => <p>{q.property}: {fixDateString(q.item, q.item in props.qrs ? props.qrs[q.item].date.precision : -1)}</p>)}
					</>
				})}
			</div>
	})
	return (
		<div id="timeline">
			{cards}
		</div>
	)
}

render(<App />, document.getElementById('app'));
