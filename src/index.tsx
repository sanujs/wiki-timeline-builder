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
	date: dayjs.Dayjs,
	precision: number,
}
type WikidataItem = {
	property: string,
	item: string,
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

export const formatUsingPrecision = (item: string | dayjs.Dayjs, precision: number) : string => {
	// Format date strings or objects to the correct string given a precision value
	let date: dayjs.Dayjs;
	// Convert string to date
	switch (typeof item) {
		case "string":
			if (dayjs(item, "YYYY-MM-DDTHH:mm:ssZ").isValid()) {
				date = dayjs(item, "YYYY-MM-DDTHH:mm:ssZ"), precision;
			} else {
				// If item is not a date, return the string untouched
				return item;
			}
			break;
		case "object":
			date = item;
	}
	// Set UTC and precision of date and convert date to string
	date = date.utc();
	// https://www.wikidata.org/wiki/Help:Dates#Precision
	switch(precision) {
		case 7: return date.format("YYYY").substring(0, 2) + "00s";
		case 8: return date.format("YYYY").substring(0, 3) + "0s";
		case 9: return date.format("YYYY");
		case 10: return date.format("MMMM YYYY");
		default: return date.format("MMMM DD, YYYY");
	}
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
				const timelineDict: { [key: string]: TimelineCard} = {}; // Dict to merge events with the same date

				for (const result of results) {
					const event: string = result.propertyItemLabel.value + ":" + result.valueLabel.value;
					if (!(result.pointintime.value in timelineDict)) {
						// Create a new card in the timeline
						timelineDict[result.pointintime.value] = {
							date: {
								'property': result.PITQualifierLabel.value,
								'date': dayjs(result.pointintime.value, "YYYY-MM-DDTHH:mm:ssZ"),
								'precision': parseInt(result.precision.value),
							},
							events: {},
						}
					}
					if (!(event in timelineDict[result.pointintime.value].events)) {
						// Create a new event in the card
						timelineDict[result.pointintime.value].events[event] = {
							qualifiers: [],
							propertyStatement: {
								'property': result.propertyItemLabel.value,
								'item': formatUsingPrecision(
									result.valueLabel.value,
									parseInt(result.precision.value),
								),
							},
						}
					}
					if ('oqpLabel' in result) {
						// Create a new qualifier in the event
						const newQualifier: WikidataItem = {
							'property': result.oqpLabel.value,
							'item': formatUsingPrecision(
									result.oqvLabel.value,
									parseInt(result.precision.value),
								),
						}
						// Ignore duplicate qualifiers
						if (result.oqpLabel.value != result.PITQualifierLabel.value &&
							!timelineDict[result.pointintime.value].events[event].qualifiers.some(e =>
								e.property == newQualifier.property && e.item == newQualifier.item
							)
						)
							timelineDict[result.pointintime.value].events[event].qualifiers.push(newQualifier);
					}
				}
				setLoading(false);
				// Sort the timeline by date before saving it in the state
				setTimelineState(
					Object.values(timelineDict).sort((a: TimelineCard, b: TimelineCard) => {
						if (a.date.date.isBefore(b.date.date)) {
							return -1
						}
						return 1
					}
				));
			})
	}
	useEffect(()=>{console.log("timelineState:", timelineState)}, [timelineState])

	return (
		<div>
			<h1>Build a beautiful timeline</h1>
			<Search value={search} setSearch={setSearch} suggestions={suggestions} userSelect={userSelectWikiData}/>
			{loading ? <img id="loadingAnimation" src={loadingAnimation} /> : <Timeline cards={timelineState}/>}
		</div>
	);
}

render(<App />, document.getElementById('app'));
