import { useEffect, useState } from "preact/hooks";
import { TimelineObject, TimelineCard } from "../index";
import dayjs from "dayjs";

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

export default Timeline;
