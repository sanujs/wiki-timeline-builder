import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './style.css';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import loadingAnimation from './assets/loading.gif';
import Search from './components/Search';
import Timeline from './components/Timeline';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export type WikiSuggestion = {
	description: string,
	pageid: number,
	label: string,
	url: string,
	id: string,
}

type QueryObject = {
	datatype: string,
	type: string,
	value: string,
}

// Properties of this type are dependant on the SPARQL query being sent
type QueryResult = {
	pointintime: QueryObject,
	precision: QueryObject,
	propertyItemLabel: QueryObject,
	PITQualifierLabel: QueryObject,
	valueLabel: QueryObject,
	oqpLabel?: QueryObject,
	oqvLabel?: QueryObject,
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

export type TimelineCard = {
	date: WikidataDate,
	events: {
		[key: string]: { // Event (formatted as "<propertyitem>:<valueitem>")
			propertyStatement: WikidataItem, // propertyItemLabel and valueLabel
			qualifiers: WikidataItem[],
		}
	}
}

export type TimelineObject = {
	// key is a timeline date as a string
	[key: string]: TimelineCard
}

const App = () => {
	const [search, setSearch] = useState('');
	const [error, setError] = useState(null);
	const [suggestions, setSuggestions] = useState([]);
	const [timelineState, setTimelineState] = useState([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Get suggestions during a search
		const paramsObj = {
			origin: "*",
			action: "wbsearchentities",
			search: search,
			format: "json",
			errorformat: "plaintext",
			language: "en",
			uselang: "en",
			type: "item",
		}
		fetch("https://www.wikidata.org/w/api.php?" + new URLSearchParams(paramsObj).toString(), {
			method: "GET",
			headers: {
				"Origin": "*"
			}
		})
			.then(response => {
				console.log(response);
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				if ("errors" in response) {
					if (response["errors"][0]["code"] != "missingparam") {
						setError(response["errors"][0])
					} else {
						setSuggestions([])
					}
					return
				}
				const pages: { [key: number]: WikiSuggestion } = response.search;
				const newState: WikiSuggestion[] = Object.values(pages);
				console.log(newState);
				setSuggestions(newState)
			})
	}, [search])
	const userSelectWikiData = (choice: WikiSuggestion): void => {
		// User clicks a suggestion
		setSearch('');
		setSuggestions([]);
		setLoading(true);
		const itemID = choice.id;
		console.log(itemID);
		// SPARQL Query: https://w.wiki/9Yk6
		const query = `
		  SELECT ?propertyItemLabel ?valueLabel ?PITQualifierLabel ?pointintime ?precision ?oqpLabel ?oqvLabel WHERE {
			BIND(wd:${itemID} as ?item).
			{
			  ?item ?property [?pValue ?valuenode].
			  ?propertyItem wikibase:statementValue ?pValue.
			  ?valuenode wikibase:timeValue ?pointintime.
			  ?valuenode wikibase:timePrecision ?precision.
			  BIND(?pointintime as ?value).
			  BIND(?propertyItem as ?PITQualifier).
			}
			UNION
			{
			  ?item ?property ?statement.
			  ?statement ?pValue ?valuenode.
			  ?PITQualifier wikibase:qualifierValue ?pValue.
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
		fetch("https://query.wikidata.org/sparql?origin=*&format=json&query=" + query)
			.then(response => {
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				console.log("response: ", response)
				const results: QueryResult[] = response.results.bindings;
				const to = {};

				for (const result of results) {
					const event: string = result.propertyItemLabel.value + ":" + result.valueLabel.value;
					if (!(result.pointintime.value in to)) {
						to[result.pointintime.value] = {
							date: {
								'property': result.PITQualifierLabel.value,
								'item': dayjs(result.pointintime.value, "YYYY-MM-DDTHH:mm:ssZ"),
								'precision': parseInt(result.precision.value),
							},
							events: {},
						}
					}
					if (!(event in to[result.pointintime.value].events)) {
						to[result.pointintime.value].events[event] = {
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
						if (result.oqpLabel.value != result.PITQualifierLabel.value &&
							!to[result.pointintime.value].events[event].qualifiers.some(e =>
								e.property == newQualifier.property && e.item == newQualifier.item
							)
						)
							to[result.pointintime.value].events[event].qualifiers.push(newQualifier);
					}
				}
				setLoading(false);
				setTimelineState(
					Object.values(to).sort((a: TimelineCard, b: TimelineCard) => {
						if (a.date.item.isBefore(b.date.item)) {
							return -1
						}
						return 1
					}
				));
			})
	}
	useEffect(()=>{console.log("TO:", timelineState)}, [timelineState])

	return (
		<div>
			<h1>Build a beautiful timeline</h1>
			<Search value={search} setSearch={setSearch} suggestions={suggestions} userSelect={userSelectWikiData}/>
			{loading ? <img id="loadingAnimation" src={loadingAnimation} /> : <Timeline to={timelineState}/>}
		</div>
	);
}

render(<App />, document.getElementById('app'));
