import { TimelineCard } from "../index";
import dayjs from "dayjs";

type TimelineProps = {
	cards: TimelineCard[],
}

const Timeline = (props: TimelineProps) => {
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
	let left = false;
	const cards = props.cards.map(card => {
		left = !left;
		return <div className={left ? "event left" : "event right"}>
				<h1>{fixDateString(card.date.date, card.date.precision)}</h1>
				{Object.values(card.events).map(event => {
					return <>
						<h4>
						{`${event.propertyStatement.property}: ${fixDateString(
							event.propertyStatement.item,
							event.propertyStatement.item in props.cards ? props.cards[event.propertyStatement.item].date.precision : -1
						)} (${card.date.property})`}
						</h4>
						{'qualifiers' in event && event.qualifiers.map(q => <p>
							{q.property}: {fixDateString(
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
