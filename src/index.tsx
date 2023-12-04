import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { SetStateAction } from 'preact/compat';
import './style.css';
import * as dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat)

type WikiSuggestion = {
	description: string,
	descriptionsource?: string,
	index: number,
	ns?: number,
	pageid: number,
	title: string
}

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

	const userSelect = (choice: WikiSuggestion): void => {
		fetch("https://www.wikidata.org/w/api.php?origin=*&action=wbgetentities&sites=enwiki&props=claims&format=json&titles=" + choice.title)
			.then(response => {
				if (!response.ok) {
					throw response;
				}
				return response.json();
			})
			.then(response => {
				console.log("response: ", Object.values(response.entities))
				const dates = [
					(Object.values(response.entities)[0] as any).claims.P580?.[0].mainsnak.datavalue.value.time.substring(1),
					(Object.values(response.entities)[0] as any).claims.P582?.[0].mainsnak.datavalue.value.time.substring(1),
				]
				return {
					title: choice.title,
					description: choice.description,
					dateStart: dayjs(dates[0]),
					...dates.length > 1 && {dateEnd: dayjs(dates[1])},
				}
			})
			.then(newEvent => {
				console.log("new event: ", newEvent)
				const i = selectedEvents.findIndex((curEvent => curEvent.dateStart.isAfter(newEvent.dateStart)))
				if (i==-1) {
					setSelectedEvents([...selectedEvents, newEvent]);
				} else {
					setSelectedEvents(selectedEvents.slice(0, i).concat(newEvent, selectedEvents.slice(i)))
				}
				setSearch('')
				setSuggestions([])
			})
	}
	useEffect(()=>{console.log(selectedEvents)}, [selectedEvents])
				
	return (
		<div>
			<h1>Get started building a beautiful timeline</h1>
			<Search value={search} setSearch={setSearch} suggestions={suggestions} userSelect={userSelect}/>
			<Timeline events={selectedEvents}/>
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

type TimelineEvent = {
	title: string,
	description: string,
	dateStart: dayjs.Dayjs,
	dateEnd?: dayjs.Dayjs,
}

type TimelineProps = {
	events: TimelineEvent[]
}

const Timeline = (props: TimelineProps) => {
	let left = false;
	const events = props.events.map(e => {
		left = !left;
		return <div className={left ? "event left" : "event right"}>
				<h1>{e.dateStart.format("MMMM DD, YYYY")}</h1>
				<h2>{e.title}</h2>
				<p>{e.description}</p>
			</div>
		}
	)
	return (
		<div id="timeline">
			{events}
		</div>
	)
}

render(<App />, document.getElementById('app'));
