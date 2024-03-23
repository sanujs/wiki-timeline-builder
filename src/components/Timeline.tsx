import { TimelineCard } from "../index";
import dayjs from "dayjs";

type TimelineProps = {
	cards: TimelineCard[],
}

const Timeline = (props: TimelineProps) => {
	const formatUsingPrecision = (item: string | dayjs.Dayjs, precision: number) : string => {
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
	let left = false; // Determine what side of the line to render the card
	const cards = props.cards.map(card => {
		left = !left;
		return <div className={left ? "event left" : "event right"}>
				<h1>{formatUsingPrecision(card.date.date, card.date.precision)}</h1>
				{Object.values(card.events).map(event => {
					return <>
						<h4>
                            {/* If the event propertyStatement item is a date in string format then we
                                find it's equivalent precision in the timeline object to format the string */}
                            {`${event.propertyStatement.property}: ${formatUsingPrecision(
                                event.propertyStatement.item,
                                event.propertyStatement.item in props.cards ? props.cards[event.propertyStatement.item].date.precision : -1
                            )} (${card.date.property})`}
						</h4>
						{'qualifiers' in event && event.qualifiers.map(q => <p>
							{q.property}: {formatUsingPrecision(
								q.item, q.item in props.cards ? props.cards[q.item].date.precision : -1
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

export default Timeline;
