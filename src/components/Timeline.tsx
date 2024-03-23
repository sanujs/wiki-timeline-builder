import { TimelineCard, formatUsingPrecision } from "../index";

type TimelineProps = {
	cards: TimelineCard[],
}

const Timeline = (props: TimelineProps) => {
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
                            {`${event.propertyStatement.property}: ${event.propertyStatement.item } (${card.date.property})`}
						</h4>
						{'qualifiers' in event && event.qualifiers.map(q => <p>
							{q.property}: {q.item}
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
