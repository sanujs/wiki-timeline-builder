import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { SetStateAction } from 'preact/compat';
import './style.css';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import loadingAnimation from './assets/loading.gif';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

type WikiSuggestion = {
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
	qualifierItemLabel: QueryObject,
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

type TimelineCard = {
	date: WikidataDate,
	events: {
		[key: string]: { // Event (formatted as "<propertyitem>:<valueitem>")
			propertyStatement: WikidataItem,
			qualifiers: WikidataItem[],
		}
	}
}

type TimelineObject = {
	// key is a timeline date as a string
	[key: string]: TimelineCard
}

const App = () => {
	const [search, setSearch] = useState('');
	const [error, setError] = useState(null);
	const [suggestions, setSuggestions] = useState([]);
	const [timelineState, setTimelineState] = useState({});
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
		// SPARQL Query: https://w.wiki/8UZ9
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
				const to: TimelineObject = {};

				for (const result of results) {
					const event: string = result.propertyItemLabel.value + ":" + result.valueLabel.value;
					if (!(result.pointintime.value in to)) {
						to[result.pointintime.value] = {
							date: {
								'property': result.qualifierItemLabel.value,
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
						if (result.oqpLabel.value != result.qualifierItemLabel.value &&
							!to[result.pointintime.value].events[event].qualifiers.some(e =>
								e.property == newQualifier.property && e.item == newQualifier.item
							)
						)
							to[result.pointintime.value].events[event].qualifiers.push(newQualifier);
					}
				}
				setLoading(false);
				setTimelineState(to);
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
					<h4>{suggestion.label}</h4>
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
	to: TimelineObject,
}

const Timeline = (props: TimelineProps) => {
	const [timelineCards, setTimelineCards] = useState([] as TimelineCard[]);
	const fixDateString = (item: string | dayjs.Dayjs, precision: number) : string => {
		switch (typeof item) {
			case "string":
				if (dayjs(item, "YYYY-MM-DDTHH:mm:ssZ").isValid()) {
					return formatUsingPrecision(dayjs(item, "YYYY-MM-DDTHH:mm:ssZ"), precision);
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
	useEffect(()=> {
		let timeline: TimelineCard[] = [];
		for (const timelineCard of Object.values(props.to)) {
			const i = timeline.findIndex((curEvent => (curEvent.date.item as dayjs.Dayjs).isAfter(timelineCard.date.item)))
			if (i==-1) {
				timeline.push(timelineCard);
			} else {
				timeline = timeline.slice(0, i).concat(timelineCard, timeline.slice(i))
			}
		}
		setTimelineCards(timeline);
	}, [props.to]);
	let left = false;
	const cards = timelineCards.map(card => {
		left = !left;
		return <div className={left ? "event left" : "event right"}>
				<h1>{fixDateString(card.date.item, card.date.precision)}</h1>
				{Object.values(card.events).map(event => {
					return <>
						<h4>
						{`${event.propertyStatement.property}: ${fixDateString(
							event.propertyStatement.item,
							event.propertyStatement.item in props.to ? props.to[event.propertyStatement.item].date.precision : -1
						)} (${card.date.property})`}
						</h4>
						{'qualifiers' in event && event.qualifiers.map(q => <p>
							{q.property}: {fixDateString(
								q.item, q.item in props.to ? props.to[q.item].date.precision : -1
							)}
						</p>)}
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
