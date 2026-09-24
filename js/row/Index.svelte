<script lang="ts">
	import { StatusTracker } from "@gradio/statustracker";
	import type { ILoadingStatus as LoadingStatus } from "@gradio/statustracker";
	import { Gradio } from "@gradio/utils";

	const get_dimension = (
		dimension_value: string | number | undefined
	): string | undefined => {
		if (dimension_value === undefined) {
			return undefined;
		}
		if (typeof dimension_value === "number") {
			return dimension_value + "px";
		} else if (typeof dimension_value === "string") {
			return dimension_value;
		}
	};

	let props = $props();
	let gradio = new Gradio<
		{},
		{
			variant: "default" | "panel" | "compact";
			height: number | string | undefined;
			min_height: number | string | undefined;
			max_height: number | string | undefined;
		}
	>(props);
</script>

<div
	class:compact={gradio.props.variant === "compact"}
	class:panel={gradio.props.variant === "panel"}
	class:hide={!gradio.shared.visible}
	class:grow-children={gradio.shared.scale && gradio.shared.scale >= 1}
	style:height={get_dimension(gradio.props.height)}
	style:max-height={get_dimension(gradio.props.max_height)}
	style:min-height={get_dimension(gradio.props.min_height)}
	style:flex-grow={gradio.shared.scale}
	id={gradio.shared.elem_id}
	class="row {gradio.shared.elem_classes?.join(' ')}"
>
	{#if gradio.shared.loading_status && gradio.shared.loading_status.show_progress && gradio}
		<StatusTracker
			autoscroll={gradio.shared.autoscroll}
			i18n={gradio.i18n}
			{...gradio.shared.loading_status}
			status={gradio.shared.loading_status
				? gradio.shared.loading_status.status == "pending"
					? "generating"
					: gradio.shared.loading_status.status
				: null}
		/>
	{/if}
	{@render props.children?.()}
</div>

<style>
	div {
		display: flex;
		flex-wrap: wrap;
		gap: var(--layout-gap);
		width: var(--size-full);
		position: relative;
		/* Equal-height is now the default: the flex container's default
		   `align-items` value is `stretch`, which makes every direct child
		   fill the row's cross-axis (height). No flag is needed. */
	}

	.hide {
		display: none;
	}
	.compact > :global(*),
	.compact :global(.box) {
		border-radius: 0;
	}
	.compact,
	.panel {
		border-radius: var(--container-radius);
		background: var(--background-fill-secondary);
		padding: var(--size-2);
	}

	/* Children placed inside .column or .form inside a row grow vertically
	   so that a tall column makes its sibling columns' inner content stretch
	   to the same height. Previously gated behind the `.stretch` class which
	   was only applied when `equal_height=True`. */
	div > :global(.column > *),
	div > :global(.column > .form > *) {
		flex-grow: 1;
		flex-shrink: 0;
	}

	div > :global(*),
	div > :global(.form > *) {
		flex: 1 1 0%;
		flex-wrap: wrap;
		min-width: min(160px, 100%);
	}

	.grow-children > :global(.column) {
		align-self: stretch;
	}
</style>
