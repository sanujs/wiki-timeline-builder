import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { SetStateAction } from 'preact/compat';
import './style.css';
import * as dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc)

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
				// TODO: Standardize error handling
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

	const dateError = () => {
		console.log("Error: Cannot parse date from date header")
	}

	const userSelectWikiData = (choice: WikiSuggestion): void => {
		setSearch('');
		setSuggestions([]);
		fetch("https://en.wikipedia.org/w/api.php?origin=*&action=query&prop=pageprops&ppprop=wikibase_item&formatversion=2&format=json&titles=" + choice.title)
			.then(response => {
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				console.log(response);
				const itemID = response.query.pages[0].pageprops.wikibase_item;
				// https://w.wiki/8Qwo
				const query = `
				SELECT ?propertyItemLabel ?valueLabel ?qualifierItemLabel ?pointintime ?precision ?oqpLabel ?oqvLabel WHERE {
					{
					  wd:${itemID} ?property [?pValue ?valuenode].
					  ?propertyItem wikibase:statementValue ?pValue.
					  ?valuenode wikibase:timeValue ?pointintime.
					  ?valuenode wikibase:timePrecision ?precision.
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
					let fullItem = true;
					if (!('valueLabel' in result)) {
						fullItem = false;
					}
					// TODO: Add check/log for unexpected query results (neither fullitem/non-fullitem)
					if (!(result.pointintime.value in qr)) {
						qr[result.pointintime.value] = {
							date: {
								'property': fullItem ? result.qualifierItemLabel.value : result.propertyItemLabel.value,
								'item': dayjs(result.pointintime.value),
								'precision': parseInt(result.precision.value),
							},
							...fullItem && {propertyStatement: {
									'property': result.propertyItemLabel.value,
									'item': result.valueLabel.value,
								},
								qualifiers: [{
									'property': result.oqpLabel.value,
									'item': result.oqvLabel.value,
								}]
							}
						}
					} else {
						if (result.oqpLabel.value == result.qualifierItemLabel.value) {
							continue;
						}
						if (!qr[result.pointintime.value].qualifiers) {
							qr[result.pointintime.value].qualifiers = [];
						}
						qr[result.pointintime.value].qualifiers.push({
								'property': result.oqpLabel.value,
								'item': result.oqvLabel.value,
							});
					}
				}
				setQueryResults(qr);
			})
	}
	useEffect(()=>{console.log(queryResults)}, [queryResults])

	return (
		<div>
			<h1>Get started building a beautiful timeline</h1>
			<Search value={search} setSearch={setSearch} suggestions={suggestions} userSelect={userSelectWikiData}/>
			<Timeline qrs={queryResults}/>
		</div>
	);
}

type Wikidata = {
	property: string,
	item: string | dayjs.Dayjs,
	precision?: number,
}

type QueryResult = {
	[key: string]: {
		date: Wikidata,
		propertyStatement?: Wikidata,
		qualifiers?: Wikidata[],
	}
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
	const fixDateString = (item: string, precision: number) => {
		if (dayjs(item).isValid()) {
			return formatUsingPrecision(dayjs(item).utc(), precision);
		}
		return item;
	}
	const formatUsingPrecision = (date: dayjs.Dayjs, precision: number): string => {
		switch(precision) {
			case 7: return date.format("YYYY").substring(0, 2) + "00s";
			case 8: return date.format("YYYY").substring(0, 3) + "0s";
			case 9: return date.format("YYYY");
			case 10: return date.format("MMMM YYYY");
			default: return date.format("MMMM DD, YYYY");
		}
	}
	let left = false;
	let qrArray = [];
	for (const qr of Object.values(props.qrs)) {
		const i = qrArray.findIndex((curEvent => curEvent.date.item.isAfter(qr.date.item)))
		if (i==-1) {
			qrArray.push(qr);
		} else {
			qrArray = qrArray.slice(0, i).concat(qr, qrArray.slice(i))
		}
	}
	const events = qrArray.map(qr => {
		left = !left;
		return <div className={left ? "event left" : "event right"}>
				<h1>{formatUsingPrecision(qr.date.item.utc(), qr.date.precision)}</h1>
				<h4>{'propertyStatement' in qr ? qr.propertyStatement.property + ": " + fixDateString(qr.propertyStatement.item, qr.propertyStatement.item in props.qrs ? props.qrs[qr.propertyStatement.item].date.precision : -1) + " (" + qr.date.property + ")" : qr.date.property}</h4>
				{'qualifiers' in qr && qr.qualifiers.map(x => <p>{x.property}: {fixDateString(x.item, x.item in props.qrs ? props.qrs[x.item].date.precision : -1)}</p>)}
			</div>
	})
	return (
		<div id="timeline">
			{events}
		</div>
	)
}

render(<App />, document.getElementById('app'));
